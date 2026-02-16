import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { runPreparedReply } from "./get-reply-run.js";

mock("../../agents/auth-profiles/session-override.js", () => ({
  resolveSessionAuthProfileOverride: mock().mockResolvedValue(undefined),
}));

mock("../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: mock().mockReturnValue(false),
  isEmbeddedPiRunActive: mock().mockReturnValue(false),
  isEmbeddedPiRunStreaming: mock().mockReturnValue(false),
  resolveEmbeddedSessionLane: mock().mockReturnValue("session:session-key"),
}));

mock("../../config/sessions.js", () => ({
  resolveGroupSessionKey: mock().mockReturnValue(undefined),
  resolveSessionFilePath: mock().mockReturnValue("/tmp/session.jsonl"),
  resolveSessionFilePathOptions: mock().mockReturnValue({}),
  updateSessionStore: mock(),
}));

mock("../../globals.js", () => ({
  logVerbose: mock(),
}));

mock("../../process/command-queue.js", () => ({
  clearCommandLane: mock().mockReturnValue(0),
  getQueueSize: mock().mockReturnValue(0),
}));

mock("../../routing/session-key.js", () => ({
  normalizeMainKey: mock().mockReturnValue("main"),
}));

mock("../../utils/provider-utils.js", () => ({
  isReasoningTagProvider: mock().mockReturnValue(false),
}));

mock("../command-detection.js", () => ({
  hasControlCommand: mock().mockReturnValue(false),
}));

mock("./agent-runner.js", () => ({
  runReplyAgent: mock().mockResolvedValue({ text: "ok" }),
}));

mock("./body.js", () => ({
  applySessionHints: mock().mockImplementation(async ({ baseBody }) => baseBody),
}));

mock("./groups.js", () => ({
  buildGroupIntro: mock().mockReturnValue(""),
  buildGroupChatContext: mock().mockReturnValue(""),
}));

mock("./inbound-meta.js", () => ({
  buildInboundMetaSystemPrompt: mock().mockReturnValue(""),
  buildInboundUserContextPrefix: mock().mockReturnValue(""),
}));

mock("./queue.js", () => ({
  resolveQueueSettings: mock().mockReturnValue({ mode: "followup" }),
}));

mock("./route-reply.js", () => ({
  routeReply: mock(),
}));

mock("./session-updates.js", () => ({
  ensureSkillSnapshot: mock().mockImplementation(async ({ sessionEntry, systemSent }) => ({
    sessionEntry,
    systemSent,
    skillsSnapshot: undefined,
  })),
  prependSystemEvents: mock().mockImplementation(async ({ prefixedBodyBase }) => prefixedBodyBase),
}));

mock("./typing-mode.js", () => ({
  resolveTypingMode: mock().mockReturnValue("off"),
}));

import { runReplyAgent } from "./agent-runner.js";

function baseParams(
  overrides: Partial<Parameters<typeof runPreparedReply>[0]> = {},
): Parameters<typeof runPreparedReply>[0] {
  return {
    ctx: {
      Body: "",
      RawBody: "",
      CommandBody: "",
      ThreadHistoryBody: "Earlier message in this thread",
      OriginatingChannel: "slack",
      OriginatingTo: "C123",
      ChatType: "group",
    },
    sessionCtx: {
      Body: "",
      BodyStripped: "",
      ThreadHistoryBody: "Earlier message in this thread",
      MediaPath: "/tmp/input.png",
      Provider: "slack",
      ChatType: "group",
      OriginatingChannel: "slack",
      OriginatingTo: "C123",
    },
    cfg: { session: {}, channels: {}, agents: { defaults: {} } },
    agentId: "default",
    agentDir: "/tmp/agent",
    agentCfg: {},
    sessionCfg: {},
    commandAuthorized: true,
    command: {
      isAuthorizedSender: true,
      abortKey: "session-key",
      ownerList: [],
      senderIsOwner: false,
    } as never,
    commandSource: "",
    allowTextCommands: true,
    directives: {
      hasThinkDirective: false,
      thinkLevel: undefined,
    } as never,
    defaultActivation: "always",
    resolvedThinkLevel: "high",
    resolvedVerboseLevel: "off",
    resolvedReasoningLevel: "off",
    resolvedElevatedLevel: "off",
    elevatedEnabled: false,
    elevatedAllowed: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    modelState: {
      resolveDefaultThinkingLevel: async () => "medium",
    } as never,
    provider: "anthropic",
    model: "claude-opus-4-1",
    typing: {
      onReplyStart: mock().mockResolvedValue(undefined),
      cleanup: mock(),
    } as never,
    defaultProvider: "anthropic",
    defaultModel: "claude-opus-4-1",
    timeoutMs: 30_000,
    isNewSession: true,
    resetTriggered: false,
    systemSent: true,
    sessionKey: "session-key",
    workspaceDir: "/tmp/workspace",
    abortedLastRun: false,
    ...overrides,
  };
}

describe("runPreparedReply media-only handling", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("allows media-only prompts and preserves thread context in queued followups", async () => {
    const result = await runPreparedReply(baseParams());
    expect(result).toEqual({ text: "ok" });

    const call = vi.mocked(runReplyAgent).mock.calls[0]?.[0];
    expect(call).toBeTruthy();
    expect(call?.followupRun.prompt).toContain("[Thread history - for context]");
    expect(call?.followupRun.prompt).toContain("Earlier message in this thread");
    expect(call?.followupRun.prompt).toContain("[User sent media without caption]");
  });

  it("returns the empty-body reply when there is no text and no media", async () => {
    const result = await runPreparedReply(
      baseParams({
        ctx: {
          Body: "",
          RawBody: "",
          CommandBody: "",
        },
        sessionCtx: {
          Body: "",
          BodyStripped: "",
          Provider: "slack",
        },
      }),
    );

    expect(result).toEqual({
      text: "I didn't receive any text in your message. Please resend or add a caption.",
    });
    expect(vi.mocked(runReplyAgent)).not.toHaveBeenCalled();
  });
});
