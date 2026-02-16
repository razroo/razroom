import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const sendTypingMock = mock();
const sendReadReceiptMock = mock();
const dispatchInboundMessageMock = mock(
  async (params: { replyOptions?: { onReplyStart?: () => void } }) => {
    await Promise.resolve(params.replyOptions?.onReplyStart?.());
    return { queuedFinal: false, counts: { tool: 0, block: 0, final: 0 } };
  },
);

mock("./send.js", () => ({
  sendMessageSignal: mock(),
  sendTypingSignal: (...args: unknown[]) => sendTypingMock(...args),
  sendReadReceiptSignal: (...args: unknown[]) => sendReadReceiptMock(...args),
}));

mock("../auto-reply/dispatch.js", () => ({
  dispatchInboundMessage: (...args: unknown[]) => dispatchInboundMessageMock(...args),
  dispatchInboundMessageWithDispatcher: (...args: unknown[]) => dispatchInboundMessageMock(...args),
  dispatchInboundMessageWithBufferedDispatcher: (...args: unknown[]) =>
    dispatchInboundMessageMock(...args),
}));

mock("../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: mock().mockResolvedValue([]),
  upsertChannelPairingRequest: mock(),
}));

describe("signal event handler typing + read receipts", () => {
  beforeEach(() => {
    // TODO: Restore real timers;
    sendTypingMock.mockReset().mockResolvedValue(true);
    sendReadReceiptMock.mockReset().mockResolvedValue(true);
    dispatchInboundMessageMock.mockClear();
  });

  it("sends typing + read receipt for allowed DMs", async () => {
    const { createSignalEventHandler } = await import("./monitor/event-handler.js");
    const handler = createSignalEventHandler({
      // oxlint-disable-next-line typescript/no-explicit-any
      runtime: { log: () => {}, error: () => {} } as any,
      cfg: {
        messages: { inbound: { debounceMs: 0 } },
        channels: { signal: { dmPolicy: "open", allowFrom: ["*"] } },
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any,
      baseUrl: "http://localhost",
      account: "+15550009999",
      accountId: "default",
      blockStreaming: false,
      historyLimit: 0,
      groupHistories: new Map(),
      textLimit: 4000,
      dmPolicy: "open",
      allowFrom: ["*"],
      groupAllowFrom: ["*"],
      groupPolicy: "open",
      reactionMode: "off",
      reactionAllowlist: [],
      mediaMaxBytes: 1024,
      ignoreAttachments: true,
      sendReadReceipts: true,
      readReceiptsViaDaemon: false,
      fetchAttachment: async () => null,
      deliverReplies: async () => {},
      resolveSignalReactionTargets: () => [],
      // oxlint-disable-next-line typescript/no-explicit-any
      isSignalReactionMessage: () => false as any,
      shouldEmitSignalReactionNotification: () => false,
      buildSignalReactionSystemEventText: () => "reaction",
    });

    await handler({
      event: "receive",
      data: JSON.stringify({
        envelope: {
          sourceNumber: "+15550001111",
          sourceName: "Alice",
          timestamp: 1700000000000,
          dataMessage: {
            message: "hi",
          },
        },
      }),
    });

    expect(sendTypingMock).toHaveBeenCalledWith("signal:+15550001111", expect.any(Object));
    expect(sendReadReceiptMock).toHaveBeenCalledWith(
      "signal:+15550001111",
      1700000000000,
      expect.any(Object),
    );
  });
});
