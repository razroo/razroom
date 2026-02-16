import { describe, expect, it } from "bun:test";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#moltbot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#moltbot",
      rawTarget: "#moltbot",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "moltbot-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "moltbot-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "moltbot-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "moltbot-bot",
      rawTarget: "moltbot-bot",
    });
  });
});
