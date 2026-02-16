import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { RuntimeEnv } from "../runtime.js";
import { WizardCancelledError } from "../wizard/prompts.js";
import { runInteractiveOnboarding } from "./onboard-interactive.js";

const mocks = vi.hoisted(() => ({
  createClackPrompter: mock(() => ({ id: "prompter" })),
  runOnboardingWizard: mock(async () => {}),
  restoreTerminalState: mock(),
}));

mock("../wizard/clack-prompter.js", () => ({
  createClackPrompter: mocks.createClackPrompter,
}));

mock("../wizard/onboarding.js", () => ({
  runOnboardingWizard: mocks.runOnboardingWizard,
}));

mock("../terminal/restore.js", () => ({
  restoreTerminalState: mocks.restoreTerminalState,
}));

function makeRuntime(): RuntimeEnv {
  return {
    log: mock(),
    error: mock(),
    exit: mock() as unknown as RuntimeEnv["exit"],
  };
}

describe("runInteractiveOnboarding", () => {
  afterEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("restores terminal state without resuming stdin on success", async () => {
    const runtime = makeRuntime();

    await runInteractiveOnboarding({} as never, runtime);

    expect(mocks.runOnboardingWizard).toHaveBeenCalledOnce();
    expect(mocks.restoreTerminalState).toHaveBeenCalledWith("onboarding finish", {
      resumeStdinIfPaused: false,
    });
  });

  it("restores terminal state without resuming stdin on cancel", async () => {
    const exitError = new Error("exit");
    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(() => {
        throw exitError;
      }) as unknown as RuntimeEnv["exit"],
    };
    mocks.runOnboardingWizard.mockRejectedValueOnce(new WizardCancelledError("cancelled"));

    await expect(runInteractiveOnboarding({} as never, runtime)).rejects.toBe(exitError);

    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(mocks.restoreTerminalState).toHaveBeenCalledWith("onboarding finish", {
      resumeStdinIfPaused: false,
    });
    const restoreOrder =
      mocks.restoreTerminalState.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER;
    const exitOrder =
      (runtime.exit as unknown as ReturnType<typeof mock>).mock.invocationCallOrder[0] ??
      Number.MAX_SAFE_INTEGER;
    expect(restoreOrder).toBeLessThan(exitOrder);
  });
});
