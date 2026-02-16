import { describe, expect, it, mock, spyOn } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { setLoggerOverride } from "../logging.js";
import {
  installWebAutoReplyTestHomeHooks,
  installWebAutoReplyUnitTestHooks,
} from "./auto-reply.test-harness.js";
import { monitorWebChannel } from "./auto-reply/monitor.js";

installWebAutoReplyTestHomeHooks();

describe("web auto-reply monitor logging", () => {
  installWebAutoReplyUnitTestHooks();

  it("emits heartbeat logs with connection metadata", async () => {
    vi.useFakeTimers();
    const logPath = `/tmp/razroom-heartbeat-${crypto.randomUUID()}.log`;
    setLoggerOverride({ level: "trace", file: logPath });

    const runtime = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    const controller = new AbortController();
    const listenerFactory = mock(async () => {
      const onClose = new Promise<void>(() => {
        // never resolves; abort will short-circuit
      });
      return { close: mock(), onClose };
    });

    const run = monitorWebChannel(
      false,
      listenerFactory as never,
      true,
      async () => ({ text: "ok" }),
      runtime as never,
      controller.signal,
      {
        heartbeatSeconds: 1,
        reconnect: { initialMs: 5, maxMs: 5, maxAttempts: 1, factor: 1.1 },
      },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await vi.runAllTimersAsync();
    await run.catch(() => {});

    const content = await fs.readFile(logPath, "utf-8");
    expect(content).toMatch(/web-heartbeat/);
    expect(content).toMatch(/connectionId/);
    expect(content).toMatch(/messagesHandled/);
    vi.useRealTimers();
  });

  it("logs outbound replies to file", async () => {
    const logPath = `/tmp/razroom-log-test-${crypto.randomUUID()}.log`;
    setLoggerOverride({ level: "trace", file: logPath });

    let capturedOnMessage:
      | ((msg: import("./inbound.js").WebInboundMessage) => Promise<void>)
      | undefined;
    const listenerFactory = async (opts: {
      onMessage: (msg: import("./inbound.js").WebInboundMessage) => Promise<void>;
    }) => {
      capturedOnMessage = opts.onMessage;
      return { close: mock() };
    };

    const resolver = mock().mockResolvedValue({ text: "auto" });
    await monitorWebChannel(false, listenerFactory as never, false, resolver as never);
    expect(capturedOnMessage).toBeDefined();

    await capturedOnMessage?.({
      body: "hello",
      from: "+1",
      to: "+2",
      id: "msg1",
      sendComposing: mock(),
      reply: mock(),
      sendMedia: mock(),
    });

    const content = await fs.readFile(logPath, "utf-8");
    expect(content).toMatch(/web-auto-reply/);
    expect(content).toMatch(/auto/);
  });
});
