import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { createTempHomeHarness, makeReplyConfig } from "./reply.test-harness.js";

const runEmbeddedPiAgentMock = mock();

mock("../agents/model-fallback.js", () => ({
  runWithModelFallback: async ({
    provider,
    model,
    run,
  }: {
    provider: string;
    model: string;
    run: (provider: string, model: string) => Promise<unknown>;
  }) => ({
    result: await run(provider, model),
    provider,
    model,
  }),
}));

mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: mock().mockReturnValue(false),
  runEmbeddedPiAgent: (params: unknown) => runEmbeddedPiAgentMock(params),
  queueEmbeddedPiMessage: mock().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: mock().mockReturnValue(false),
  isEmbeddedPiRunStreaming: mock().mockReturnValue(false),
}));

const webMocks = vi.hoisted(() => ({
  webAuthExists: mock().mockResolvedValue(true),
  getWebAuthAgeMs: mock().mockReturnValue(120_000),
  readWebSelfId: mock().mockReturnValue({ e164: "+1999" }),
}));

mock("../web/session.js", () => webMocks);

import { getReplyFromConfig } from "./reply.js";

const { withTempHome } = createTempHomeHarness({
  prefix: "openclaw-typing-",
  beforeEachCase: () => runEmbeddedPiAgentMock.mockClear(),
});

afterEach(() => {
  // TODO: Review mock restoration;
});

describe("getReplyFromConfig typing (heartbeat)", () => {
  beforeEach(() => {
    vi.stubEnv("OPENCLAW_TEST_FAST", "1");
  });

  it("starts typing for normal runs", async () => {
    await withTempHome(async (home) => {
      runEmbeddedPiAgentMock.mockResolvedValueOnce({
        payloads: [{ text: "ok" }],
        meta: {},
      });
      const onReplyStart = mock();

      await getReplyFromConfig(
        { Body: "hi", From: "+1000", To: "+2000", Provider: "whatsapp" },
        { onReplyStart, isHeartbeat: false },
        makeReplyConfig(home),
      );

      expect(onReplyStart).toHaveBeenCalled();
    });
  });

  it("does not start typing for heartbeat runs", async () => {
    await withTempHome(async (home) => {
      runEmbeddedPiAgentMock.mockResolvedValueOnce({
        payloads: [{ text: "ok" }],
        meta: {},
      });
      const onReplyStart = mock();

      await getReplyFromConfig(
        { Body: "hi", From: "+1000", To: "+2000", Provider: "whatsapp" },
        { onReplyStart, isHeartbeat: true },
        makeReplyConfig(home),
      );

      expect(onReplyStart).not.toHaveBeenCalled();
    });
  });
});
