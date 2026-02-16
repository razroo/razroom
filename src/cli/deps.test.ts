import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { createDefaultDeps } from "./deps.js";

const moduleLoads = vi.hoisted(() => ({
  whatsapp: mock(),
  telegram: mock(),
  discord: mock(),
  slack: mock(),
  signal: mock(),
  imessage: mock(),
}));

const sendFns = vi.hoisted(() => ({
  whatsapp: mock(async () => ({ messageId: "w1", toJid: "whatsapp:1" })),
  telegram: mock(async () => ({ messageId: "t1", chatId: "telegram:1" })),
  discord: mock(async () => ({ messageId: "d1", channelId: "discord:1" })),
  slack: mock(async () => ({ messageId: "s1", channelId: "slack:1" })),
  signal: mock(async () => ({ messageId: "sg1", conversationId: "signal:1" })),
  imessage: mock(async () => ({ messageId: "i1", chatId: "imessage:1" })),
}));

mock("../channels/web/index.js", () => {
  moduleLoads.whatsapp();
  return { sendMessageWhatsApp: sendFns.whatsapp };
});

mock("../telegram/send.js", () => {
  moduleLoads.telegram();
  return { sendMessageTelegram: sendFns.telegram };
});

mock("../discord/send.js", () => {
  moduleLoads.discord();
  return { sendMessageDiscord: sendFns.discord };
});

mock("../slack/send.js", () => {
  moduleLoads.slack();
  return { sendMessageSlack: sendFns.slack };
});

mock("../signal/send.js", () => {
  moduleLoads.signal();
  return { sendMessageSignal: sendFns.signal };
});

mock("../imessage/send.js", () => {
  moduleLoads.imessage();
  return { sendMessageIMessage: sendFns.imessage };
});

describe("createDefaultDeps", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("does not load provider modules until a dependency is used", async () => {
    const deps = createDefaultDeps();

    expect(moduleLoads.whatsapp).not.toHaveBeenCalled();
    expect(moduleLoads.telegram).not.toHaveBeenCalled();
    expect(moduleLoads.discord).not.toHaveBeenCalled();
    expect(moduleLoads.slack).not.toHaveBeenCalled();
    expect(moduleLoads.signal).not.toHaveBeenCalled();
    expect(moduleLoads.imessage).not.toHaveBeenCalled();

    const sendTelegram = deps.sendMessageTelegram as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;
    await sendTelegram("chat", "hello", { verbose: false });

    expect(moduleLoads.telegram).toHaveBeenCalledTimes(1);
    expect(sendFns.telegram).toHaveBeenCalledTimes(1);
    expect(moduleLoads.whatsapp).not.toHaveBeenCalled();
    expect(moduleLoads.discord).not.toHaveBeenCalled();
    expect(moduleLoads.slack).not.toHaveBeenCalled();
    expect(moduleLoads.signal).not.toHaveBeenCalled();
    expect(moduleLoads.imessage).not.toHaveBeenCalled();
  });

  it("reuses module cache after first dynamic import", async () => {
    const deps = createDefaultDeps();
    const sendDiscord = deps.sendMessageDiscord as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;

    await sendDiscord("channel", "first", { verbose: false });
    await sendDiscord("channel", "second", { verbose: false });

    expect(moduleLoads.discord).toHaveBeenCalledTimes(1);
    expect(sendFns.discord).toHaveBeenCalledTimes(2);
  });
});
