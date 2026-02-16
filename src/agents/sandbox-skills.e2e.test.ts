import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { MoltBotConfig } from "../config/config.js";
import { resolveSandboxContext } from "./sandbox.js";

mock("./sandbox/docker.js", () => ({
  ensureSandboxContainer: mock(async () => "moltbot-sbx-test"),
}));

mock("./sandbox/browser.js", () => ({
  ensureSandboxBrowser: mock(async () => null),
}));

mock("./sandbox/prune.js", () => ({
  maybePruneSandboxes: mock(async () => undefined),
}));

async function writeSkill(params: { dir: string; name: string; description: string }) {
  const { dir, name, description } = params;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    "utf-8",
  );
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("sandbox skill mirroring", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  const runContext = async (workspaceAccess: "none" | "ro") => {
    const bundledDir = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-bundled-skills-"));
    await fs.mkdir(bundledDir, { recursive: true });

    process.env.MOLTBOT_BUNDLED_SKILLS_DIR = bundledDir;

    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-workspace-"));
    await writeSkill({
      dir: path.join(workspaceDir, "skills", "demo-skill"),
      name: "demo-skill",
      description: "Demo skill",
    });

    const cfg: MoltBotConfig = {
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
            scope: "session",
            workspaceAccess,
            workspaceRoot: path.join(bundledDir, "sandboxes"),
          },
        },
      },
    };

    const context = await resolveSandboxContext({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir,
    });

    return { context, workspaceDir };
  };

  it("copies skills into the sandbox when workspaceAccess is ro", async () => {
    const { context } = await runContext("ro");

    expect(context?.enabled).toBe(true);
    const skillPath = path.join(context?.workspaceDir ?? "", "skills", "demo-skill", "SKILL.md");
    await expect(fs.readFile(skillPath, "utf-8")).resolves.toContain("demo-skill");
  }, 20_000);

  it("copies skills into the sandbox when workspaceAccess is none", async () => {
    const { context } = await runContext("none");

    expect(context?.enabled).toBe(true);
    const skillPath = path.join(context?.workspaceDir ?? "", "skills", "demo-skill", "SKILL.md");
    await expect(fs.readFile(skillPath, "utf-8")).resolves.toContain("demo-skill");
  }, 20_000);
});
