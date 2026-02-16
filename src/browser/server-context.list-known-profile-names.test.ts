import { describe, expect, it } from "bun:test";
import type { BrowserServerState } from "./server-context.js";
import { resolveBrowserConfig, resolveProfile } from "./config.js";
import { listKnownProfileNames } from "./server-context.js";

describe("browser server-context listKnownProfileNames", () => {
  it("includes configured and runtime-only profile names", () => {
    const resolved = resolveBrowserConfig({
      defaultProfile: "moltbot",
      profiles: {
        moltbot: { cdpPort: 18800, color: "#FF4500" },
      },
    });
    const moltbot = resolveProfile(resolved, "moltbot");
    if (!moltbot) {
      throw new Error("expected moltbot profile");
    }

    const state: BrowserServerState = {
      server: null as unknown as BrowserServerState["server"],
      port: 18791,
      resolved,
      profiles: new Map([
        [
          "stale-removed",
          {
            profile: { ...moltbot, name: "stale-removed" },
            running: null,
          },
        ],
      ]),
    };

    expect(listKnownProfileNames(state).toSorted()).toEqual([
      "chrome",
      "moltbot",
      "stale-removed",
    ]);
  });
});
