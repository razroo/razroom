import { describe, expect, it } from "bun:test";
import path from "node:path";
import { detectLegacyWorkspaceDirs } from "./doctor-workspace.js";

describe("detectLegacyWorkspaceDirs", () => {
  it("returns active workspace and no legacy dirs", () => {
    const workspaceDir = "/home/user/razroom";
    const detection = detectLegacyWorkspaceDirs({ workspaceDir });
    expect(detection.activeWorkspace).toBe(path.resolve(workspaceDir));
    expect(detection.legacyDirs).toEqual([]);
  });
});
