import { describe, expect, it } from "bun:test";
import { shouldSkipRespawnForArgv } from "./respawn-policy.js";

describe("shouldSkipRespawnForArgv", () => {
  it("skips respawn for help/version calls", () => {
    expect(shouldSkipRespawnForArgv(["node", "moltbot", "--help"])).toBe(true);
    expect(shouldSkipRespawnForArgv(["node", "moltbot", "-V"])).toBe(true);
  });

  it("keeps respawn path for normal commands", () => {
    expect(shouldSkipRespawnForArgv(["node", "moltbot", "status"])).toBe(false);
  });
});
