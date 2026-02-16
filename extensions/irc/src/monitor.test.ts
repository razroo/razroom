import { describe, expect, it } from "bun:test";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#razroom",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#razroom",
      rawTarget: "#razroom",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "razroom-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "razroom-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "razroom-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "razroom-bot",
      rawTarget: "razroom-bot",
    });
  });
});
