import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { RazroomConfig } from "../../config/config.js";
import type { MsgContext } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import type { ReplyDispatcher } from "./reply-dispatcher.js";
import { buildTestCtx } from "./test-ctx.js";

const mocks = vi.hoisted(() => ({
  routeReply: mock(async () => ({ ok: true, messageId: "mock" })),
  tryFastAbortFromMessage: mock(async () => ({
    handled: false,
    aborted: false,
  })),
}));
const diagnosticMocks = vi.hoisted(() => ({
  logMessageQueued: mock(),
  logMessageProcessed: mock(),
  logSessionStateChange: mock(),
}));
const hookMocks = vi.hoisted(() => ({
  runner: {
    hasHooks: mock(() => false),
    runMessageReceived: mock(async () => {}),
  },
}));

mock("./route-reply.js", () => ({
  isRoutableChannel: (channel: string | undefined) =>
    Boolean(
      channel &&
      ["telegram", "slack", "discord", "signal", "imessage", "whatsapp"].includes(channel),
    ),
  routeReply: mocks.routeReply,
}));

mock("./abort.js", () => ({
  tryFastAbortFromMessage: mocks.tryFastAbortFromMessage,
  formatAbortReplyText: (stoppedSubagents?: number) => {
    if (typeof stoppedSubagents !== "number" || stoppedSubagents <= 0) {
      return "⚙️ Agent was aborted.";
    }
    const label = stoppedSubagents === 1 ? "sub-agent" : "sub-agents";
    return `⚙️ Agent was aborted. Stopped ${stoppedSubagents} ${label}.`;
  },
}));

mock("../../logging/diagnostic.js", () => ({
  logMessageQueued: diagnosticMocks.logMessageQueued,
  logMessageProcessed: diagnosticMocks.logMessageProcessed,
  logSessionStateChange: diagnosticMocks.logSessionStateChange,
}));

mock("../../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => hookMocks.runner,
}));

const { dispatchReplyFromConfig } = await import("./dispatch-from-config.js");
const { resetInboundDedupe } = await import("./inbound-dedupe.js");

function createDispatcher(): ReplyDispatcher {
  return {
    sendToolResult: mock(() => true),
    sendBlockReply: mock(() => true),
    sendFinalReply: mock(() => true),
    waitForIdle: mock(async () => {}),
    getQueuedCounts: mock(() => ({ tool: 0, block: 0, final: 0 })),
    markComplete: mock(),
  };
}

describe("dispatchReplyFromConfig", () => {
  beforeEach(() => {
    resetInboundDedupe();
    diagnosticMocks.logMessageQueued.mockReset();
    diagnosticMocks.logMessageProcessed.mockReset();
    diagnosticMocks.logSessionStateChange.mockReset();
    hookMocks.runner.hasHooks.mockReset();
    hookMocks.runner.hasHooks.mockReturnValue(false);
    hookMocks.runner.runMessageReceived.mockReset();
  });
  it("does not route when Provider matches OriginatingChannel (even if Surface is missing)", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    mocks.routeReply.mockClear();
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      Surface: undefined,
      OriginatingChannel: "slack",
      OriginatingTo: "channel:C123",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      _opts: GetReplyOptions | undefined,
      _cfg: RazroomConfig,
    ) => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(mocks.routeReply).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("routes when OriginatingChannel differs from Provider", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    mocks.routeReply.mockClear();
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      AccountId: "acc-1",
      MessageThreadId: 123,
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:999",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      _opts: GetReplyOptions | undefined,
      _cfg: RazroomConfig,
    ) => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(dispatcher.sendFinalReply).not.toHaveBeenCalled();
    expect(mocks.routeReply).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "telegram:999",
        accountId: "acc-1",
        threadId: 123,
      }),
    );
  });

  it("provides onToolResult in DM sessions", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    mocks.routeReply.mockClear();
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      ChatType: "direct",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      opts: GetReplyOptions | undefined,
      _cfg: RazroomConfig,
    ) => {
      expect(opts?.onToolResult).toBeDefined();
      expect(typeof opts?.onToolResult).toBe("function");
      return { text: "hi" } satisfies ReplyPayload;
    };

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("does not provide onToolResult in group sessions", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      ChatType: "group",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      opts: GetReplyOptions | undefined,
      _cfg: RazroomConfig,
    ) => {
      expect(opts?.onToolResult).toBeUndefined();
      return { text: "hi" } satisfies ReplyPayload;
    };

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("sends tool results via dispatcher in DM sessions", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      ChatType: "direct",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      opts: GetReplyOptions | undefined,
      _cfg: RazroomConfig,
    ) => {
      // Simulate tool result emission
      await opts?.onToolResult?.({ text: "🔧 exec: ls" });
      return { text: "done" } satisfies ReplyPayload;
    };

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendToolResult).toHaveBeenCalledWith(
      expect.objectContaining({ text: "🔧 exec: ls" }),
    );
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("does not provide onToolResult for native slash commands", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      ChatType: "direct",
      CommandSource: "native",
    });

    const replyResolver = async (
      _ctx: MsgContext,
      opts: GetReplyOptions | undefined,
      _cfg: RazroomConfig,
    ) => {
      expect(opts?.onToolResult).toBeUndefined();
      return { text: "hi" } satisfies ReplyPayload;
    };

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
  });

  it("fast-aborts without calling the reply resolver", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: true,
      aborted: true,
    });
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      Body: "/stop",
    });
    const replyResolver = mock(async () => ({ text: "hi" }) as ReplyPayload);

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(replyResolver).not.toHaveBeenCalled();
    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith({
      text: "⚙️ Agent was aborted.",
    });
  });

  it("fast-abort reply includes stopped subagent count when provided", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: true,
      aborted: true,
      stoppedSubagents: 2,
    });
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "telegram",
      Body: "/stop",
    });

    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher,
      replyResolver: mock(async () => ({ text: "hi" }) as ReplyPayload),
    });

    expect(dispatcher.sendFinalReply).toHaveBeenCalledWith({
      text: "⚙️ Agent was aborted. Stopped 2 sub-agents.",
    });
  });

  it("deduplicates inbound messages by MessageSid and origin", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    const cfg = {} as RazroomConfig;
    const ctx = buildTestCtx({
      Provider: "whatsapp",
      OriginatingChannel: "whatsapp",
      OriginatingTo: "whatsapp:+15555550123",
      MessageSid: "msg-1",
    });
    const replyResolver = mock(async () => ({ text: "hi" }) as ReplyPayload);

    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver,
    });
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver,
    });

    expect(replyResolver).toHaveBeenCalledTimes(1);
  });

  it("emits message_received hook with originating channel metadata", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    hookMocks.runner.hasHooks.mockReturnValue(true);
    const cfg = {} as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      Surface: "slack",
      OriginatingChannel: "Telegram",
      OriginatingTo: "telegram:999",
      CommandBody: "/search hello",
      RawBody: "raw text",
      Body: "body text",
      Timestamp: 1710000000000,
      MessageSidFull: "sid-full",
      SenderId: "user-1",
      SenderName: "Alice",
      SenderUsername: "alice",
      SenderE164: "+15555550123",
      AccountId: "acc-1",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(hookMocks.runner.runMessageReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        from: ctx.From,
        content: "/search hello",
        timestamp: 1710000000000,
        metadata: expect.objectContaining({
          originatingChannel: "Telegram",
          originatingTo: "telegram:999",
          messageId: "sid-full",
          senderId: "user-1",
          senderName: "Alice",
          senderUsername: "alice",
          senderE164: "+15555550123",
        }),
      }),
      expect.objectContaining({
        channelId: "telegram",
        accountId: "acc-1",
        conversationId: "telegram:999",
      }),
    );
  });

  it("emits diagnostics when enabled", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    const cfg = { diagnostics: { enabled: true } } as RazroomConfig;
    const dispatcher = createDispatcher();
    const ctx = buildTestCtx({
      Provider: "slack",
      Surface: "slack",
      SessionKey: "agent:main:main",
      MessageSid: "msg-1",
      To: "slack:C123",
    });

    const replyResolver = async () => ({ text: "hi" }) satisfies ReplyPayload;
    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(diagnosticMocks.logMessageQueued).toHaveBeenCalledTimes(1);
    expect(diagnosticMocks.logSessionStateChange).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      state: "processing",
      reason: "message_start",
    });
    expect(diagnosticMocks.logMessageProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "slack",
        outcome: "completed",
        sessionKey: "agent:main:main",
      }),
    );
  });

  it("marks diagnostics skipped for duplicate inbound messages", async () => {
    mocks.tryFastAbortFromMessage.mockResolvedValue({
      handled: false,
      aborted: false,
    });
    const cfg = { diagnostics: { enabled: true } } as RazroomConfig;
    const ctx = buildTestCtx({
      Provider: "whatsapp",
      OriginatingChannel: "whatsapp",
      OriginatingTo: "whatsapp:+15555550123",
      MessageSid: "msg-dup",
    });
    const replyResolver = mock(async () => ({ text: "hi" }) as ReplyPayload);

    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver,
    });
    await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher: createDispatcher(),
      replyResolver,
    });

    expect(replyResolver).toHaveBeenCalledTimes(1);
    expect(diagnosticMocks.logMessageProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "whatsapp",
        outcome: "skipped",
        reason: "duplicate",
      }),
    );
  });
});
