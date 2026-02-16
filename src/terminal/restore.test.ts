import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

const clearActiveProgressLine = vi.hoisted(() => mock());

mock("./progress-line.js", () => ({
  clearActiveProgressLine,
}));

import { restoreTerminalState } from "./restore.js";

describe("restoreTerminalState", () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  const originalSetRawMode = (process.stdin as { setRawMode?: (mode: boolean) => void }).setRawMode;
  const originalResume = (process.stdin as { resume?: () => void }).resume;
  const originalIsPaused = (process.stdin as { isPaused?: () => boolean }).isPaused;

  afterEach(() => {
    // TODO: Review mock restoration;
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalStdinIsTTY,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalStdoutIsTTY,
      configurable: true,
    });
    (process.stdin as { setRawMode?: (mode: boolean) => void }).setRawMode = originalSetRawMode;
    (process.stdin as { resume?: () => void }).resume = originalResume;
    (process.stdin as { isPaused?: () => boolean }).isPaused = originalIsPaused;
  });

  it("does not resume paused stdin by default", () => {
    const setRawMode = mock();
    const resume = mock();
    const isPaused = mock(() => true);

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    (process.stdin as { setRawMode?: (mode: boolean) => void }).setRawMode = setRawMode;
    (process.stdin as { resume?: () => void }).resume = resume;
    (process.stdin as { isPaused?: () => boolean }).isPaused = isPaused;

    restoreTerminalState("test");

    expect(setRawMode).toHaveBeenCalledWith(false);
    expect(resume).not.toHaveBeenCalled();
  });

  it("resumes paused stdin when resumeStdin is true", () => {
    const setRawMode = mock();
    const resume = mock();
    const isPaused = mock(() => true);

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    (process.stdin as { setRawMode?: (mode: boolean) => void }).setRawMode = setRawMode;
    (process.stdin as { resume?: () => void }).resume = resume;
    (process.stdin as { isPaused?: () => boolean }).isPaused = isPaused;

    restoreTerminalState("test", { resumeStdinIfPaused: true });

    expect(setRawMode).toHaveBeenCalledWith(false);
    expect(resume).toHaveBeenCalledOnce();
  });

  it("does not touch stdin when stdin is not a TTY", () => {
    const setRawMode = mock();
    const resume = mock();
    const isPaused = mock(() => true);

    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    (process.stdin as { setRawMode?: (mode: boolean) => void }).setRawMode = setRawMode;
    (process.stdin as { resume?: () => void }).resume = resume;
    (process.stdin as { isPaused?: () => boolean }).isPaused = isPaused;

    restoreTerminalState("test", { resumeStdinIfPaused: true });

    expect(setRawMode).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });
});
