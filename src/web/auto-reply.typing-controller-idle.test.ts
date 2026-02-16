import "./test-helpers.js";
import { describe, expect, it, mock, spyOn } from "bun:test";
import type { MoltBotConfig } from "../config/config.js";
import { monitorWebChannel } from "./auto-reply.js";
import {
  installWebAutoReplyTestHomeHooks,
  installWebAutoReplyUnitTestHooks,
  resetLoadConfigMock,
  setLoadConfigMock,
} from "./auto-reply.test-harness.js";

installWebAutoReplyTestHomeHooks();

describe("typing controller idle", () => {
  installWebAutoReplyUnitTestHooks();

  it("marks dispatch idle after replies flush", async () => {
    const markDispatchIdle = mock();
    const typingMock = {
      onReplyStart: mock(async () => {}),
      startTypingLoop: mock(async () => {}),
      startTypingOnText: mock(async () => {}),
      refreshTypingTtl: mock(),
      isActive: mock(() => false),
      markRunComplete: mock(),
      markDispatchIdle,
      cleanup: mock(),
    };
    const reply = mock().mockResolvedValue(undefined);
    const sendComposing = mock().mockResolvedValue(undefined);
    const sendMedia = mock().mockResolvedValue(undefined);

    const replyResolver = mock().mockImplementation(async (_ctx, opts) => {
      opts?.onTypingController?.(typingMock);
      return { text: "final reply" };
    });

    const mockConfig: MoltBotConfig = {
      channels: { whatsapp: { allowFrom: ["*"] } },
    };

    setLoadConfigMock(mockConfig);

    await monitorWebChannel(
      false,
      async ({ onMessage }) => {
        await onMessage({
          id: "m1",
          from: "+1000",
          conversationId: "+1000",
          to: "+2000",
          body: "hello",
          timestamp: Date.now(),
          chatType: "direct",
          chatId: "direct:+1000",
          sendComposing,
          reply,
          sendMedia,
        });
        return { close: mock().mockResolvedValue(undefined) };
      },
      false,
      replyResolver,
    );

    resetLoadConfigMock();

    expect(markDispatchIdle).toHaveBeenCalled();
  });
});
