import { describe, expect, it } from "bun:test";
import { shouldSkipRespawnForArgv } from "./respawn-policy.js";

describe("shouldSkipRespawnForArgv", () => {
  it("skips respawn for help/version calls", () => {
    expect(shouldSkipRespawnForArgv(["node", "razroom", "--help"])).toBe(true);
    expect(shouldSkipRespawnForArgv(["node", "razroom", "-V"])).toBe(true);
  });

  it("keeps respawn path for normal commands", () => {
    expect(shouldSkipRespawnForArgv(["node", "razroom", "status"])).toBe(false);
  });
});
