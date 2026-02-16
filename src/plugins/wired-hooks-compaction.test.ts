/**
 * Test: before_compaction & after_compaction hook wiring
 */
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const hookMocks = vi.hoisted(() => ({
  runner: {
    hasHooks: mock(() => false),
    runBeforeCompaction: mock(async () => {}),
    runAfterCompaction: mock(async () => {}),
  },
}));

mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => hookMocks.runner,
}));

mock("../infra/agent-events.js", () => ({
  emitAgentEvent: mock(),
}));

describe("compaction hook wiring", () => {
  beforeEach(() => {
    hookMocks.runner.hasHooks.mockReset();
    hookMocks.runner.hasHooks.mockReturnValue(false);
    hookMocks.runner.runBeforeCompaction.mockReset();
    hookMocks.runner.runBeforeCompaction.mockResolvedValue(undefined);
    hookMocks.runner.runAfterCompaction.mockReset();
    hookMocks.runner.runAfterCompaction.mockResolvedValue(undefined);
  });

  it("calls runBeforeCompaction in handleAutoCompactionStart", async () => {
    hookMocks.runner.hasHooks.mockReturnValue(true);

    const { handleAutoCompactionStart } =
      await import("../agents/pi-embedded-subscribe.handlers.compaction.js");

    const ctx = {
      params: { runId: "r1", session: { messages: [1, 2, 3] } },
      state: { compactionInFlight: false },
      log: { debug: mock(), warn: mock() },
      incrementCompactionCount: mock(),
      ensureCompactionPromise: mock(),
    };

    handleAutoCompactionStart(ctx as never);

    expect(hookMocks.runner.runBeforeCompaction).toHaveBeenCalledTimes(1);

    const [event] = hookMocks.runner.runBeforeCompaction.mock.calls[0];
    expect(event.messageCount).toBe(3);
  });

  it("calls runAfterCompaction when willRetry is false", async () => {
    hookMocks.runner.hasHooks.mockReturnValue(true);

    const { handleAutoCompactionEnd } =
      await import("../agents/pi-embedded-subscribe.handlers.compaction.js");

    const ctx = {
      params: { runId: "r2", session: { messages: [1, 2] } },
      state: { compactionInFlight: true },
      log: { debug: mock(), warn: mock() },
      maybeResolveCompactionWait: mock(),
      getCompactionCount: () => 1,
    };

    handleAutoCompactionEnd(
      ctx as never,
      {
        type: "auto_compaction_end",
        willRetry: false,
      } as never,
    );

    expect(hookMocks.runner.runAfterCompaction).toHaveBeenCalledTimes(1);

    const [event] = hookMocks.runner.runAfterCompaction.mock.calls[0];
    expect(event.messageCount).toBe(2);
    expect(event.compactedCount).toBe(1);
  });

  it("does not call runAfterCompaction when willRetry is true", async () => {
    hookMocks.runner.hasHooks.mockReturnValue(true);

    const { handleAutoCompactionEnd } =
      await import("../agents/pi-embedded-subscribe.handlers.compaction.js");

    const ctx = {
      params: { runId: "r3", session: { messages: [] } },
      state: { compactionInFlight: true },
      log: { debug: mock(), warn: mock() },
      noteCompactionRetry: mock(),
      resetForCompactionRetry: mock(),
      getCompactionCount: () => 0,
    };

    handleAutoCompactionEnd(
      ctx as never,
      {
        type: "auto_compaction_end",
        willRetry: true,
      } as never,
    );

    expect(hookMocks.runner.runAfterCompaction).not.toHaveBeenCalled();
  });
});
