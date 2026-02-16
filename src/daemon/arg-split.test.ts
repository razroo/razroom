import { describe, expect, it } from "bun:test";
import { splitArgsPreservingQuotes } from "./arg-split.js";

describe("splitArgsPreservingQuotes", () => {
  it("splits on whitespace outside quotes", () => {
    expect(splitArgsPreservingQuotes('/usr/bin/razroom gateway start --name "My Bot"')).toEqual([
      "/usr/bin/razroom",
      "gateway",
      "start",
      "--name",
      "My Bot",
    ]);
  });

  it("supports systemd-style backslash escaping", () => {
    expect(
      splitArgsPreservingQuotes('razroom --name "My \\"Bot\\"" --foo bar', {
        escapeMode: "backslash",
      }),
    ).toEqual(["razroom", "--name", 'My "Bot"', "--foo", "bar"]);
  });

  it("supports schtasks-style escaped quotes while preserving other backslashes", () => {
    expect(
      splitArgsPreservingQuotes('razroom --path "C:\\\\Program Files\\\\Razroom"', {
        escapeMode: "backslash-quote-only",
      }),
    ).toEqual(["razroom", "--path", "C:\\\\Program Files\\\\Razroom"]);

    expect(
      splitArgsPreservingQuotes('razroom --label "My \\"Quoted\\" Name"', {
        escapeMode: "backslash-quote-only",
      }),
    ).toEqual(["razroom", "--label", 'My "Quoted" Name']);
  });
});
