import { describe, expect, it, mock, spyOn } from "bun:test";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

// Module under test imports these at module scope.
mock("../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: mock(),
}));
mock("../agents/skills-install.js", () => ({
  installSkill: mock(),
}));
mock("./onboard-helpers.js", () => ({
  detectBinary: mock(),
  resolveNodeManagerOptions: mock(() => [
    { value: "npm", label: "npm" },
    { value: "pnpm", label: "pnpm" },
    { value: "bun", label: "bun" },
  ]),
}));

import { installSkill } from "../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { detectBinary } from "./onboard-helpers.js";
import { setupSkills } from "./onboard-skills.js";

function createPrompter(params: {
  configure?: boolean;
  showBrewInstall?: boolean;
  multiselect?: string[];
}): { prompter: WizardPrompter; notes: Array<{ title?: string; message: string }> } {
  const notes: Array<{ title?: string; message: string }> = [];

  const confirmAnswers: boolean[] = [];
  confirmAnswers.push(params.configure ?? true);

  const prompter: WizardPrompter = {
    intro: mock(async () => {}),
    outro: mock(async () => {}),
    note: mock(async (message: string, title?: string) => {
      notes.push({ title, message });
    }),
    select: mock(async () => "npm"),
    multiselect: mock(async () => params.multiselect ?? ["__skip__"]),
    text: mock(async () => ""),
    confirm: mock(async ({ message }) => {
      if (message === "Show Homebrew install command?") {
        return params.showBrewInstall ?? false;
      }
      return confirmAnswers.shift() ?? false;
    }),
    progress: mock(() => ({ update: mock(), stop: mock() })),
  };

  return { prompter, notes };
}

const runtime: RuntimeEnv = {
  log: mock(),
  error: mock(),
  exit: ((code: number) => {
    throw new Error(`unexpected exit ${code}`);
  }) as RuntimeEnv["exit"],
};

describe("setupSkills", () => {
  it("does not recommend Homebrew when user skips installing brew-backed deps", async () => {
    if (process.platform === "win32") {
      return;
    }

    vi.mocked(detectBinary).mockResolvedValue(false);
    vi.mocked(installSkill).mockResolvedValue({
      ok: true,
      message: "Installed",
      stdout: "",
      stderr: "",
      code: 0,
    });
    vi.mocked(buildWorkspaceSkillStatus).mockReturnValue({
      workspaceDir: "/tmp/ws",
      managedSkillsDir: "/tmp/managed",
      skills: [
        {
          name: "apple-reminders",
          description: "macOS-only",
          source: "openclaw-bundled",
          bundled: true,
          filePath: "/tmp/skills/apple-reminders",
          baseDir: "/tmp/skills/apple-reminders",
          skillKey: "apple-reminders",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: false,
          requirements: { bins: ["remindctl"], anyBins: [], env: [], config: [], os: ["darwin"] },
          missing: { bins: ["remindctl"], anyBins: [], env: [], config: [], os: ["darwin"] },
          configChecks: [],
          install: [
            { id: "brew", kind: "brew", label: "Install remindctl (brew)", bins: ["remindctl"] },
          ],
        },
        {
          name: "video-frames",
          description: "ffmpeg",
          source: "openclaw-bundled",
          bundled: true,
          filePath: "/tmp/skills/video-frames",
          baseDir: "/tmp/skills/video-frames",
          skillKey: "video-frames",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: false,
          requirements: { bins: ["ffmpeg"], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: ["ffmpeg"], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [{ id: "brew", kind: "brew", label: "Install ffmpeg (brew)", bins: ["ffmpeg"] }],
        },
      ],
    });

    const { prompter, notes } = createPrompter({ multiselect: ["__skip__"] });
    await setupSkills({} as OpenClawConfig, "/tmp/ws", runtime, prompter);

    // OS-mismatched skill should be counted as unsupported, not installable/missing.
    const status = notes.find((n) => n.title === "Skills status")?.message ?? "";
    expect(status).toContain("Unsupported on this OS: 1");

    const brewNote = notes.find((n) => n.title === "Homebrew recommended");
    expect(brewNote).toBeUndefined();
  });

  it("recommends Homebrew when user selects a brew-backed install and brew is missing", async () => {
    if (process.platform === "win32") {
      return;
    }

    vi.mocked(detectBinary).mockResolvedValue(false);
    vi.mocked(installSkill).mockResolvedValue({
      ok: true,
      message: "Installed",
      stdout: "",
      stderr: "",
      code: 0,
    });
    vi.mocked(buildWorkspaceSkillStatus).mockReturnValue({
      workspaceDir: "/tmp/ws",
      managedSkillsDir: "/tmp/managed",
      skills: [
        {
          name: "video-frames",
          description: "ffmpeg",
          source: "openclaw-bundled",
          bundled: true,
          filePath: "/tmp/skills/video-frames",
          baseDir: "/tmp/skills/video-frames",
          skillKey: "video-frames",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: false,
          requirements: { bins: ["ffmpeg"], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: ["ffmpeg"], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [{ id: "brew", kind: "brew", label: "Install ffmpeg (brew)", bins: ["ffmpeg"] }],
        },
      ],
    });

    const { prompter, notes } = createPrompter({ multiselect: ["video-frames"] });
    await setupSkills({} as OpenClawConfig, "/tmp/ws", runtime, prompter);

    const brewNote = notes.find((n) => n.title === "Homebrew recommended");
    expect(brewNote).toBeDefined();
  });
});
