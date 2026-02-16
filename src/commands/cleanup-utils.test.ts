import path from "node:path";
import { describe, expect, test } from "bun:test";
import type { RazroomConfig } from "../config/config.js";
import { buildCleanupPlan } from "./cleanup-utils.js";

describe("buildCleanupPlan", () => {
  test("resolves inside-state flags and workspace dirs", () => {
    const tmpRoot = path.join(path.parse(process.cwd()).root, "tmp");
    const cfg = {
      agents: {
        defaults: { workspace: path.join(tmpRoot, "razroom-workspace-1") },
        list: [{ workspace: path.join(tmpRoot, "razroom-workspace-2") }],
      },
    };
    const plan = buildCleanupPlan({
      cfg: cfg as unknown as RazroomConfig,
      stateDir: path.join(tmpRoot, "razroom-state"),
      configPath: path.join(tmpRoot, "razroom-state", "razroom.json"),
      oauthDir: path.join(tmpRoot, "razroom-oauth"),
    });

    expect(plan.configInsideState).toBe(true);
    expect(plan.oauthInsideState).toBe(false);
    expect(new Set(plan.workspaceDirs)).toEqual(
      new Set([
        path.join(tmpRoot, "razroom-workspace-1"),
        path.join(tmpRoot, "razroom-workspace-2"),
      ]),
    );
  });
});
