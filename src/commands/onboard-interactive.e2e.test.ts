import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { RuntimeEnv } from "../runtime.js";

const mocks = vi.hoisted(() => ({
  createClackPrompter: mock(),
  runOnboardingWizard: mock(),
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

import { WizardCancelledError } from "../wizard/prompts.js";
import { runInteractiveOnboarding } from "./onboard-interactive.js";

const runtime: RuntimeEnv = {
  log: mock(),
  error: mock(),
  exit: mock(),
};

describe("runInteractiveOnboarding", () => {
  beforeEach(() => {
    mocks.createClackPrompter.mockReset();
    mocks.runOnboardingWizard.mockReset();
    mocks.restoreTerminalState.mockReset();
    runtime.log.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();

    mocks.createClackPrompter.mockReturnValue({});
  });

  it("exits with code 1 when the wizard is cancelled", async () => {
    mocks.runOnboardingWizard.mockRejectedValue(new WizardCancelledError());

    await runInteractiveOnboarding({} as never, runtime);

    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(mocks.restoreTerminalState).toHaveBeenCalledWith("onboarding finish", {
      resumeStdinIfPaused: false,
    });
  });

  it("rethrows non-cancel errors", async () => {
    const err = new Error("boom");
    mocks.runOnboardingWizard.mockRejectedValue(err);

    await expect(runInteractiveOnboarding({} as never, runtime)).rejects.toThrow("boom");

    expect(runtime.exit).not.toHaveBeenCalled();
    expect(mocks.restoreTerminalState).toHaveBeenCalledWith("onboarding finish", {
      resumeStdinIfPaused: false,
    });
  });
});
