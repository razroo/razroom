import path from "node:path";
import { describe, expect, test } from "bun:test";
import type { MoltBotConfig } from "../config/config.js";
import { buildCleanupPlan } from "./cleanup-utils.js";

describe("buildCleanupPlan", () => {
  test("resolves inside-state flags and workspace dirs", () => {
    const tmpRoot = path.join(path.parse(process.cwd()).root, "tmp");
    const cfg = {
      agents: {
        defaults: { workspace: path.join(tmpRoot, "moltbot-workspace-1") },
        list: [{ workspace: path.join(tmpRoot, "moltbot-workspace-2") }],
      },
    };
    const plan = buildCleanupPlan({
      cfg: cfg as unknown as MoltBotConfig,
      stateDir: path.join(tmpRoot, "moltbot-state"),
      configPath: path.join(tmpRoot, "moltbot-state", "moltbot.json"),
      oauthDir: path.join(tmpRoot, "moltbot-oauth"),
    });

    expect(plan.configInsideState).toBe(true);
    expect(plan.oauthInsideState).toBe(false);
    expect(new Set(plan.workspaceDirs)).toEqual(
      new Set([
        path.join(tmpRoot, "moltbot-workspace-1"),
        path.join(tmpRoot, "moltbot-workspace-2"),
      ]),
    );
  });
});
