import { describe, expect, it, mock, spyOn } from "bun:test";
import {
  createEditorSubmitHandler,
  createSubmitBurstCoalescer,
  shouldEnableWindowsGitBashPasteFallback,
} from "./tui.js";

describe("createEditorSubmitHandler", () => {
  it("routes lines starting with ! to handleBangLine", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();
    const handleBangLine = mock();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("!ls");

    expect(handleBangLine).toHaveBeenCalledTimes(1);
    expect(handleBangLine).toHaveBeenCalledWith("!ls");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(handleCommand).not.toHaveBeenCalled();
  });

  it("treats a lone ! as a normal message", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();
    const handleBangLine = mock();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("!");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("!");
  });

  it("does not treat leading whitespace before ! as a bang command", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();
    const handleBangLine = mock();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("  !ls");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith("!ls");
    expect(editor.addToHistory).toHaveBeenCalledWith("!ls");
  });

  it("trims normal messages before sending and adding to history", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();
    const handleBangLine = mock();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("  hello  ");

    expect(sendMessage).toHaveBeenCalledWith("hello");
    expect(editor.addToHistory).toHaveBeenCalledWith("hello");
  });

  it("preserves internal newlines for multiline messages", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();
    const handleBangLine = mock();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("Line 1\nLine 2\nLine 3");

    expect(sendMessage).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3");
    expect(editor.addToHistory).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3");
    expect(handleCommand).not.toHaveBeenCalled();
    expect(handleBangLine).not.toHaveBeenCalled();
  });
});

describe("createSubmitBurstCoalescer", () => {
  it("coalesces rapid single-line submits into one multiline submit when enabled", () => {
    // TODO: Implement fake timers for Bun;
    const submit = mock();
    let now = 1_000;
    const onSubmit = createSubmitBurstCoalescer({
      submit,
      enabled: true,
      burstWindowMs: 50,
      now: () => now,
    });

    onSubmit("Line 1");
    now += 10;
    onSubmit("Line 2");
    now += 10;
    onSubmit("Line 3");

    expect(submit).not.toHaveBeenCalled();

    // TODO: Advance timers(50);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3");
    // TODO: Restore real timers;
  });

  it("passes through immediately when disabled", () => {
    const submit = mock();
    const onSubmit = createSubmitBurstCoalescer({
      submit,
      enabled: false,
    });

    onSubmit("Line 1");
    onSubmit("Line 2");

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenNthCalledWith(1, "Line 1");
    expect(submit).toHaveBeenNthCalledWith(2, "Line 2");
  });
});

describe("shouldEnableWindowsGitBashPasteFallback", () => {
  it("enables fallback on Windows Git Bash env", () => {
    expect(
      shouldEnableWindowsGitBashPasteFallback({
        platform: "win32",
        env: {
          MSYSTEM: "MINGW64",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(true);
  });

  it("disables fallback outside Windows", () => {
    expect(
      shouldEnableWindowsGitBashPasteFallback({
        platform: "darwin",
        env: {
          MSYSTEM: "MINGW64",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(false);
  });
});
