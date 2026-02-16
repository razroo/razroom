import { describe, expect, it } from "bun:test";
import { splitArgsPreservingQuotes } from "./arg-split.js";

describe("splitArgsPreservingQuotes", () => {
  it("splits on whitespace outside quotes", () => {
    expect(splitArgsPreservingQuotes('/usr/bin/moltbot gateway start --name "My Bot"')).toEqual([
      "/usr/bin/moltbot",
      "gateway",
      "start",
      "--name",
      "My Bot",
    ]);
  });

  it("supports systemd-style backslash escaping", () => {
    expect(
      splitArgsPreservingQuotes('moltbot --name "My \\"Bot\\"" --foo bar', {
        escapeMode: "backslash",
      }),
    ).toEqual(["moltbot", "--name", 'My "Bot"', "--foo", "bar"]);
  });

  it("supports schtasks-style escaped quotes while preserving other backslashes", () => {
    expect(
      splitArgsPreservingQuotes('moltbot --path "C:\\\\Program Files\\\\MoltBot"', {
        escapeMode: "backslash-quote-only",
      }),
    ).toEqual(["moltbot", "--path", "C:\\\\Program Files\\\\MoltBot"]);

    expect(
      splitArgsPreservingQuotes('moltbot --label "My \\"Quoted\\" Name"', {
        escapeMode: "backslash-quote-only",
      }),
    ).toEqual(["moltbot", "--label", 'My "Quoted" Name']);
  });
});
