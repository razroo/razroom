import { describe, expect, it } from "bun:test";
import type { BrowserServerState } from "./server-context.js";
import { resolveBrowserConfig, resolveProfile } from "./config.js";
import { listKnownProfileNames } from "./server-context.js";

describe("browser server-context listKnownProfileNames", () => {
  it("includes configured and runtime-only profile names", () => {
    const resolved = resolveBrowserConfig({
      defaultProfile: "razroom",
      profiles: {
        razroom: { cdpPort: 18800, color: "#FF4500" },
      },
    });
    const razroom = resolveProfile(resolved, "razroom");
    if (!razroom) {
      throw new Error("expected razroom profile");
    }

    const state: BrowserServerState = {
      server: null as unknown as BrowserServerState["server"],
      port: 18791,
      resolved,
      profiles: new Map([
        [
          "stale-removed",
          {
            profile: { ...razroom, name: "stale-removed" },
            running: null,
          },
        ],
      ]),
    };

    expect(listKnownProfileNames(state).toSorted()).toEqual(["chrome", "razroom", "stale-removed"]);
  });
});
