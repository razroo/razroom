import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";
import { runOnboardingWizard } from "./onboarding.js";

const ensureAuthProfileStore = vi.hoisted(() => mock(() => ({ profiles: {} })));
const promptAuthChoiceGrouped = vi.hoisted(() => mock(async () => "skip"));
const applyAuthChoice = vi.hoisted(() => mock(async (args) => ({ config: args.config })));
const resolvePreferredProviderForAuthChoice = vi.hoisted(() => mock(() => "openai"));
const warnIfModelConfigLooksOff = vi.hoisted(() => mock(async () => {}));
const applyPrimaryModel = vi.hoisted(() => mock((cfg) => cfg));
const promptDefaultModel = vi.hoisted(() => mock(async () => ({ config: null, model: null })));
const promptCustomApiConfig = vi.hoisted(() => mock(async (args) => ({ config: args.config })));
const configureGatewayForOnboarding = vi.hoisted(() =>
  mock(async (args) => ({
    nextConfig: args.nextConfig,
    settings: {
      port: args.localPort ?? 18789,
      bind: "loopback",
      authMode: "token",
      gatewayToken: "test-token",
      tailscaleMode: "off",
      tailscaleResetOnExit: false,
    },
  })),
);
const finalizeOnboardingWizard = vi.hoisted(() =>
  mock(async (options) => {
    if (!process.env.BRAVE_API_KEY) {
      await options.prompter.note("hint", "Web search (optional)");
    }

    if (options.opts.skipUi) {
      return { launchedTui: false };
    }

    const hatch = await options.prompter.select({
      message: "How do you want to hatch your bot?",
      options: [],
    });
    if (hatch !== "tui") {
      return { launchedTui: false };
    }

    let message: string | undefined;
    try {
      await fs.stat(path.join(options.workspaceDir, DEFAULT_BOOTSTRAP_FILENAME));
      message = "Wake up, my friend!";
    } catch {
      message = undefined;
    }

    await runTui({ deliver: false, message });
    return { launchedTui: true };
  }),
);
const listChannelPlugins = vi.hoisted(() => mock(() => []));
const logConfigUpdated = vi.hoisted(() => mock(() => {}));
const setupInternalHooks = vi.hoisted(() => mock(async (cfg) => cfg));

const setupChannels = vi.hoisted(() => mock(async (cfg) => cfg));
const setupSkills = vi.hoisted(() => mock(async (cfg) => cfg));
const healthCommand = vi.hoisted(() => mock(async () => {}));
const ensureWorkspaceAndSessions = vi.hoisted(() => mock(async () => {}));
const writeConfigFile = vi.hoisted(() => mock(async () => {}));
const readConfigFileSnapshot = vi.hoisted(() =>
  mock(async () => ({ exists: false, valid: true, config: {} })),
);
const ensureSystemdUserLingerInteractive = vi.hoisted(() => mock(async () => {}));
const isSystemdUserServiceAvailable = vi.hoisted(() => mock(async () => true));
const ensureControlUiAssetsBuilt = vi.hoisted(() => mock(async () => ({ ok: true })));
const runTui = vi.hoisted(() => mock(async () => {}));
const setupOnboardingShellCompletion = vi.hoisted(() => mock(async () => {}));

mock("../commands/onboard-channels.js", () => ({
  setupChannels,
}));

mock("../commands/onboard-skills.js", () => ({
  setupSkills,
}));

mock("../agents/auth-profiles.js", () => ({
  ensureAuthProfileStore,
}));

mock("../commands/auth-choice-prompt.js", () => ({
  promptAuthChoiceGrouped,
}));

mock("../commands/auth-choice.js", () => ({
  applyAuthChoice,
  resolvePreferredProviderForAuthChoice,
  warnIfModelConfigLooksOff,
}));

mock("../commands/model-picker.js", () => ({
  applyPrimaryModel,
  promptDefaultModel,
}));

mock("../commands/onboard-custom.js", () => ({
  promptCustomApiConfig,
}));

mock("../commands/health.js", () => ({
  healthCommand,
}));

mock("../commands/onboard-hooks.js", () => ({
  setupInternalHooks,
}));

mock("../config/config.js", () => ({
  DEFAULT_GATEWAY_PORT: 18789,
  resolveGatewayPort: () => 18789,
  readConfigFileSnapshot,
  writeConfigFile,
}));

mock("../commands/onboard-helpers.js", () => ({
  DEFAULT_WORKSPACE: "/tmp/razroom-workspace",
  applyWizardMetadata: (cfg: unknown) => cfg,
  summarizeExistingConfig: () => "summary",
  handleReset: async () => {},
  randomToken: () => "test-token",
  normalizeGatewayTokenInput: (value: unknown) => ({
    ok: true,
    token: typeof value === "string" ? value.trim() : "",
    error: null,
  }),
  validateGatewayPasswordInput: () => ({ ok: true, error: null }),
  ensureWorkspaceAndSessions,
  detectBrowserOpenSupport: mock(async () => ({ ok: false })),
  openUrl: mock(async () => true),
  printWizardHeader: mock(),
  probeGatewayReachable: mock(async () => ({ ok: true })),
  waitForGatewayReachable: mock(async () => {}),
  formatControlUiSshHint: mock(() => "ssh hint"),
  resolveControlUiLinks: mock(() => ({
    httpUrl: "http://127.0.0.1:18789",
    wsUrl: "ws://127.0.0.1:18789",
  })),
}));

mock("../commands/systemd-linger.js", () => ({
  ensureSystemdUserLingerInteractive,
}));

mock("../daemon/systemd.js", () => ({
  isSystemdUserServiceAvailable,
}));

mock("../infra/control-ui-assets.js", () => ({
  ensureControlUiAssetsBuilt,
}));

mock("../channels/plugins/index.js", () => ({
  listChannelPlugins,
}));

mock("../config/logging.js", () => ({
  logConfigUpdated,
}));

mock("../tui/tui.js", () => ({
  runTui,
}));

mock("./onboarding.gateway-config.js", () => ({
  configureGatewayForOnboarding,
}));

mock("./onboarding.finalize.js", () => ({
  finalizeOnboardingWizard,
}));

mock("./onboarding.completion.js", () => ({
  setupOnboardingShellCompletion,
}));

function createWizardPrompter(overrides?: Partial<WizardPrompter>): WizardPrompter {
  return {
    intro: mock(async () => {}),
    outro: mock(async () => {}),
    note: mock(async () => {}),
    select: mock(async () => "quickstart"),
    multiselect: mock(async () => []),
    text: mock(async () => ""),
    confirm: mock(async () => false),
    progress: mock(() => ({ update: mock(), stop: mock() })),
    ...overrides,
  };
}

function createRuntime(opts?: { throwsOnExit?: boolean }): RuntimeEnv {
  if (opts?.throwsOnExit) {
    return {
      log: mock(),
      error: mock(),
      exit: mock((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };
  }

  return {
    log: mock(),
    error: mock(),
    exit: mock(),
  };
}

describe("runOnboardingWizard", () => {
  let suiteRoot = "";
  let suiteCase = 0;

  beforeAll(async () => {
    suiteRoot = await fs.mkdtemp(path.join(os.tmpdir(), "razroom-onboard-suite-"));
  });

  afterAll(async () => {
    await fs.rm(suiteRoot, { recursive: true, force: true });
    suiteRoot = "";
    suiteCase = 0;
  });

  async function makeCaseDir(prefix: string): Promise<string> {
    const dir = path.join(suiteRoot, `${prefix}${++suiteCase}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  it("exits when config is invalid", async () => {
    readConfigFileSnapshot.mockResolvedValueOnce({
      path: "/tmp/.razroom/razroom.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: false,
      config: {},
      issues: [{ path: "routing.allowFrom", message: "Legacy key" }],
      legacyIssues: [{ path: "routing.allowFrom", message: "Legacy key" }],
    });

    const select: WizardPrompter["select"] = mock(async () => "quickstart");
    const prompter = createWizardPrompter({ select });
    const runtime = createRuntime({ throwsOnExit: true });

    await expect(
      runOnboardingWizard(
        {
          acceptRisk: true,
          flow: "quickstart",
          authChoice: "skip",
          installDaemon: false,
          skipProviders: true,
          skipSkills: true,
          skipHealth: true,
          skipUi: true,
        },
        runtime,
        prompter,
      ),
    ).rejects.toThrow("exit:1");

    expect(select).not.toHaveBeenCalled();
    expect(prompter.outro).toHaveBeenCalled();
  });

  it("skips prompts and setup steps when flags are set", async () => {
    const select: WizardPrompter["select"] = mock(async () => "quickstart");
    const multiselect: WizardPrompter["multiselect"] = mock(async () => []);
    const prompter = createWizardPrompter({ select, multiselect });
    const runtime = createRuntime({ throwsOnExit: true });

    await runOnboardingWizard(
      {
        acceptRisk: true,
        flow: "quickstart",
        authChoice: "skip",
        installDaemon: false,
        skipProviders: true,
        skipSkills: true,
        skipHealth: true,
        skipUi: true,
      },
      runtime,
      prompter,
    );

    expect(select).not.toHaveBeenCalled();
    expect(setupChannels).not.toHaveBeenCalled();
    expect(setupSkills).not.toHaveBeenCalled();
    expect(healthCommand).not.toHaveBeenCalled();
    expect(runTui).not.toHaveBeenCalled();
  });

  async function runTuiHatchTest(params: {
    writeBootstrapFile: boolean;
    expectedMessage: string | undefined;
  }) {
    runTui.mockClear();

    const workspaceDir = await makeCaseDir("workspace-");
    if (params.writeBootstrapFile) {
      await fs.writeFile(path.join(workspaceDir, DEFAULT_BOOTSTRAP_FILENAME), "{}");
    }

    const select: WizardPrompter["select"] = mock(async (opts) => {
      if (opts.message === "How do you want to hatch your bot?") {
        return "tui";
      }
      return "quickstart";
    });

    const prompter = createWizardPrompter({ select });
    const runtime = createRuntime({ throwsOnExit: true });

    await runOnboardingWizard(
      {
        acceptRisk: true,
        flow: "quickstart",
        mode: "local",
        workspace: workspaceDir,
        authChoice: "skip",
        skipProviders: true,
        skipSkills: true,
        skipHealth: true,
        installDaemon: false,
      },
      runtime,
      prompter,
    );

    expect(runTui).toHaveBeenCalledWith(
      expect.objectContaining({
        deliver: false,
        message: params.expectedMessage,
      }),
    );
  }

  it("launches TUI without auto-delivery when hatching", async () => {
    await runTuiHatchTest({ writeBootstrapFile: true, expectedMessage: "Wake up, my friend!" });
  });

  it("offers TUI hatch even without BOOTSTRAP.md", async () => {
    await runTuiHatchTest({ writeBootstrapFile: false, expectedMessage: undefined });
  });

  it("shows the web search hint at the end of onboarding", async () => {
    const prevBraveKey = process.env.BRAVE_API_KEY;
    delete process.env.BRAVE_API_KEY;

    try {
      const note: WizardPrompter["note"] = mock(async () => {});
      const prompter = createWizardPrompter({ note });
      const runtime = createRuntime();

      await runOnboardingWizard(
        {
          acceptRisk: true,
          flow: "quickstart",
          authChoice: "skip",
          installDaemon: false,
          skipProviders: true,
          skipSkills: true,
          skipHealth: true,
          skipUi: true,
        },
        runtime,
        prompter,
      );

      const calls = (note as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.some((call) => call?.[1] === "Web search (optional)")).toBe(true);
    } finally {
      if (prevBraveKey === undefined) {
        delete process.env.BRAVE_API_KEY;
      } else {
        process.env.BRAVE_API_KEY = prevBraveKey;
      }
    }
  });
});
