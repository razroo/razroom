import { describe, expect, it, mock, spyOn } from "bun:test";
import { setupOnboardingShellCompletion } from "./onboarding.completion.js";

describe("setupOnboardingShellCompletion", () => {
  it("QuickStart: installs without prompting", async () => {
    const prompter = {
      confirm: mock(async () => false),
      note: mock(async () => {}),
    };

    const deps = {
      resolveCliName: () => "moltbot",
      checkShellCompletionStatus: mock(async () => ({
        shell: "zsh",
        profileInstalled: false,
        cacheExists: false,
        cachePath: "/tmp/moltbot.zsh",
        usesSlowPattern: false,
      })),
      ensureCompletionCacheExists: mock(async () => true),
      installCompletion: mock(async () => {}),
    };

    await setupOnboardingShellCompletion({ flow: "quickstart", prompter, deps });

    expect(prompter.confirm).not.toHaveBeenCalled();
    expect(deps.ensureCompletionCacheExists).toHaveBeenCalledWith("moltbot");
    expect(deps.installCompletion).toHaveBeenCalledWith("zsh", true, "moltbot");
    expect(prompter.note).toHaveBeenCalled();
  });

  it("Advanced: prompts; skip means no install", async () => {
    const prompter = {
      confirm: mock(async () => false),
      note: mock(async () => {}),
    };

    const deps = {
      resolveCliName: () => "moltbot",
      checkShellCompletionStatus: mock(async () => ({
        shell: "zsh",
        profileInstalled: false,
        cacheExists: false,
        cachePath: "/tmp/moltbot.zsh",
        usesSlowPattern: false,
      })),
      ensureCompletionCacheExists: mock(async () => true),
      installCompletion: mock(async () => {}),
    };

    await setupOnboardingShellCompletion({ flow: "advanced", prompter, deps });

    expect(prompter.confirm).toHaveBeenCalledTimes(1);
    expect(deps.ensureCompletionCacheExists).not.toHaveBeenCalled();
    expect(deps.installCompletion).not.toHaveBeenCalled();
    expect(prompter.note).not.toHaveBeenCalled();
  });
});
