import { describe, expect, it, mock, spyOn } from "bun:test";
import { createEditorSubmitHandler } from "./tui.js";

describe("createEditorSubmitHandler", () => {
  it("adds submitted messages to editor history", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand: mock(),
      sendMessage: mock(),
      handleBangLine: mock(),
    });

    handler("hello world");

    expect(editor.setText).toHaveBeenCalledWith("");
    expect(editor.addToHistory).toHaveBeenCalledWith("hello world");
  });

  it("trims input before adding to history", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand: mock(),
      sendMessage: mock(),
      handleBangLine: mock(),
    });

    handler("   hi   ");

    expect(editor.addToHistory).toHaveBeenCalledWith("hi");
  });

  it("does not add empty-string submissions to history", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand: mock(),
      sendMessage: mock(),
      handleBangLine: mock(),
    });

    handler("");

    expect(editor.addToHistory).not.toHaveBeenCalled();
  });

  it("does not add whitespace-only submissions to history", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand: mock(),
      sendMessage: mock(),
      handleBangLine: mock(),
    });

    handler("   ");

    expect(editor.addToHistory).not.toHaveBeenCalled();
  });

  it("routes slash commands to handleCommand", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine: mock(),
    });

    handler("/models");

    expect(editor.addToHistory).toHaveBeenCalledWith("/models");
    expect(handleCommand).toHaveBeenCalledWith("/models");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("routes normal messages to sendMessage", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleCommand = mock();
    const sendMessage = mock();

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine: mock(),
    });

    handler("hello");

    expect(editor.addToHistory).toHaveBeenCalledWith("hello");
    expect(sendMessage).toHaveBeenCalledWith("hello");
    expect(handleCommand).not.toHaveBeenCalled();
  });

  it("routes bang-prefixed lines to handleBangLine", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const handleBangLine = mock();

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand: mock(),
      sendMessage: mock(),
      handleBangLine,
    });

    handler("!ls");

    expect(handleBangLine).toHaveBeenCalledWith("!ls");
  });

  it("treats a lone ! as a normal message", () => {
    const editor = {
      setText: mock(),
      addToHistory: mock(),
    };
    const sendMessage = mock();

    const handler = createEditorSubmitHandler({
      editor,
      handleCommand: mock(),
      sendMessage,
      handleBangLine: mock(),
    });

    handler("!");

    expect(sendMessage).toHaveBeenCalledWith("!");
  });
});
