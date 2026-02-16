import "./run.overflow-compaction.mocks.shared.js";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock("../auth-profiles.js", () => ({
  isProfileInCooldown: mock(() => false),
  markAuthProfileFailure: mock(async () => {}),
  markAuthProfileGood: mock(async () => {}),
  markAuthProfileUsed: mock(async () => {}),
}));

mock("../usage.js", () => ({
  normalizeUsage: mock((usage?: unknown) =>
    usage && typeof usage === "object" ? usage : undefined,
  ),
  derivePromptTokens: mock(
    (usage?: { input?: number; cacheRead?: number; cacheWrite?: number }) => {
      if (!usage) {
        return undefined;
      }
      const input = usage.input ?? 0;
      const cacheRead = usage.cacheRead ?? 0;
      const cacheWrite = usage.cacheWrite ?? 0;
      const sum = input + cacheRead + cacheWrite;
      return sum > 0 ? sum : undefined;
    },
  ),
}));

mock("../workspace-run.js", () => ({
  resolveRunWorkspaceDir: mock((params: { workspaceDir: string }) => ({
    workspaceDir: params.workspaceDir,
    usedFallback: false,
    fallbackReason: undefined,
    agentId: "main",
  })),
  redactRunIdentifier: mock((value?: string) => value ?? ""),
}));

mock("../pi-embedded-helpers.js", () => ({
  formatBillingErrorMessage: mock(() => ""),
  classifyFailoverReason: mock(() => null),
  formatAssistantErrorText: mock(() => ""),
  isAuthAssistantError: mock(() => false),
  isBillingAssistantError: mock(() => false),
  isCompactionFailureError: mock(() => false),
  isLikelyContextOverflowError: mock((msg?: string) => {
    const lower = (msg ?? "").toLowerCase();
    return lower.includes("request_too_large") || lower.includes("context window exceeded");
  }),
  isFailoverAssistantError: mock(() => false),
  isFailoverErrorMessage: mock(() => false),
  parseImageSizeError: mock(() => null),
  parseImageDimensionError: mock(() => null),
  isRateLimitAssistantError: mock(() => false),
  isTimeoutErrorMessage: mock(() => false),
  pickFallbackThinkingLevel: mock(() => null),
}));

import { compactEmbeddedPiSessionDirect } from "./compact.js";
import { runEmbeddedPiAgent } from "./run.js";
import { makeAttemptResult } from "./run.overflow-compaction.fixture.js";
import { runEmbeddedAttempt } from "./run/attempt.js";

const mockedRunEmbeddedAttempt = vi.mocked(runEmbeddedAttempt);
const mockedCompactDirect = vi.mocked(compactEmbeddedPiSessionDirect);

describe("runEmbeddedPiAgent overflow compaction trigger routing", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("passes trigger=overflow when retrying compaction after context overflow", async () => {
    const overflowError = new Error("request_too_large: Request size exceeds model context window");

    mockedRunEmbeddedAttempt
      .mockResolvedValueOnce(makeAttemptResult({ promptError: overflowError }))
      .mockResolvedValueOnce(makeAttemptResult({ promptError: null }));

    mockedCompactDirect.mockResolvedValueOnce({
      ok: true,
      compacted: true,
      result: {
        summary: "Compacted session",
        firstKeptEntryId: "entry-5",
        tokensBefore: 150000,
      },
    });

    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-1",
    });

    expect(mockedCompactDirect).toHaveBeenCalledTimes(1);
    expect(mockedCompactDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "overflow",
        authProfileId: "test-profile",
      }),
    );
  });
});
