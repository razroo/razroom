import { describe, expect, it, mock, spyOn } from "bun:test";
import type { RazroomConfig } from "../../config/config.js";
import { handleWhatsAppAction } from "./whatsapp-actions.js";

const sendReactionWhatsApp = mock(async () => undefined);
const sendPollWhatsApp = mock(async () => ({ messageId: "poll-1", toJid: "jid-1" }));

mock("../../web/outbound.js", () => ({
  sendReactionWhatsApp: (...args: unknown[]) => sendReactionWhatsApp(...args),
  sendPollWhatsApp: (...args: unknown[]) => sendPollWhatsApp(...args),
}));

const enabledConfig = {
  channels: { whatsapp: { actions: { reactions: true } } },
} as RazroomConfig;

describe("handleWhatsAppAction", () => {
  it("adds reactions", async () => {
    await handleWhatsAppAction(
      {
        action: "react",
        chatJid: "123@s.whatsapp.net",
        messageId: "msg1",
        emoji: "✅",
      },
      enabledConfig,
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith("123@s.whatsapp.net", "msg1", "✅", {
      verbose: false,
      fromMe: undefined,
      participant: undefined,
      accountId: undefined,
    });
  });

  it("removes reactions on empty emoji", async () => {
    await handleWhatsAppAction(
      {
        action: "react",
        chatJid: "123@s.whatsapp.net",
        messageId: "msg1",
        emoji: "",
      },
      enabledConfig,
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith("123@s.whatsapp.net", "msg1", "", {
      verbose: false,
      fromMe: undefined,
      participant: undefined,
      accountId: undefined,
    });
  });

  it("removes reactions when remove flag set", async () => {
    await handleWhatsAppAction(
      {
        action: "react",
        chatJid: "123@s.whatsapp.net",
        messageId: "msg1",
        emoji: "✅",
        remove: true,
      },
      enabledConfig,
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith("123@s.whatsapp.net", "msg1", "", {
      verbose: false,
      fromMe: undefined,
      participant: undefined,
      accountId: undefined,
    });
  });

  it("passes account scope and sender flags", async () => {
    await handleWhatsAppAction(
      {
        action: "react",
        chatJid: "123@s.whatsapp.net",
        messageId: "msg1",
        emoji: "🎉",
        accountId: "work",
        fromMe: true,
        participant: "999@s.whatsapp.net",
      },
      enabledConfig,
    );
    expect(sendReactionWhatsApp).toHaveBeenCalledWith("123@s.whatsapp.net", "msg1", "🎉", {
      verbose: false,
      fromMe: true,
      participant: "999@s.whatsapp.net",
      accountId: "work",
    });
  });

  it("respects reaction gating", async () => {
    const cfg = {
      channels: { whatsapp: { actions: { reactions: false } } },
    } as RazroomConfig;
    await expect(
      handleWhatsAppAction(
        {
          action: "react",
          chatJid: "123@s.whatsapp.net",
          messageId: "msg1",
          emoji: "✅",
        },
        cfg,
      ),
    ).rejects.toThrow(/WhatsApp reactions are disabled/);
  });
});
