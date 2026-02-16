import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { CronService } from "./service.js";

const noopLogger = {
  debug: mock(),
  info: mock(),
  warn: mock(),
  error: mock(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-delivery-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("CronService delivery plan consistency", () => {
  it("does not post isolated summary when legacy deliver=false", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const cron = new CronService({
      cronEnabled: true,
      storePath: store.storePath,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow: mock(),
      runIsolatedAgentJob: mock(async () => ({ status: "ok", summary: "done" })),
    });
    await cron.start();
    const job = await cron.add({
      name: "legacy-off",
      schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: "hello",
        deliver: false,
      },
    });

    const result = await cron.run(job.id, "force");
    expect(result).toEqual({ ok: true, ran: true });
    expect(enqueueSystemEvent).not.toHaveBeenCalled();

    cron.stop();
    await store.cleanup();
  });

  it("treats delivery object without mode as announce", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const cron = new CronService({
      cronEnabled: true,
      storePath: store.storePath,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow: mock(),
      runIsolatedAgentJob: mock(async () => ({ status: "ok", summary: "done" })),
    });
    await cron.start();
    const job = await cron.add({
      name: "partial-delivery",
      schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: "hello",
      },
      delivery: { channel: "telegram", to: "123" } as unknown as {
        mode: "none" | "announce";
        channel?: string;
        to?: string;
      },
    });

    const result = await cron.run(job.id, "force");
    expect(result).toEqual({ ok: true, ran: true });
    expect(enqueueSystemEvent).toHaveBeenCalledWith(
      "Cron: done",
      expect.objectContaining({ agentId: undefined }),
    );

    cron.stop();
    await store.cleanup();
  });

  it("does not enqueue duplicate relay when isolated run marks delivery handled", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const requestHeartbeatNow = mock();
    const runIsolatedAgentJob = mock(async () => ({
      status: "ok" as const,
      summary: "done",
      delivered: true,
    }));
    const cron = new CronService({
      cronEnabled: true,
      storePath: store.storePath,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });
    await cron.start();
    const job = await cron.add({
      name: "announce-delivered",
      schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message: "hello",
      },
      delivery: { channel: "telegram", to: "123" } as unknown as {
        mode: "none" | "announce";
        channel?: string;
        to?: string;
      },
    });

    const result = await cron.run(job.id, "force");
    expect(result).toEqual({ ok: true, ran: true });
    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    expect(requestHeartbeatNow).not.toHaveBeenCalled();

    cron.stop();
    await store.cleanup();
  });
});
