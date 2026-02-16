import { describe, expect, it, mock, spyOn } from "bun:test";
import { createLocalShellRunner } from "./tui-local-shell.js";

const createSelector = () => {
  const selector = {
    onSelect: undefined as ((item: { value: string; label: string }) => void) | undefined,
    onCancel: undefined as (() => void) | undefined,
    render: () => ["selector"],
    invalidate: () => {},
  };
  return selector;
};

describe("createLocalShellRunner", () => {
  it("logs denial on subsequent ! attempts without re-prompting", async () => {
    const messages: string[] = [];
    const chatLog = {
      addSystem: (line: string) => {
        messages.push(line);
      },
    };
    const tui = { requestRender: mock() };
    const openOverlay = mock();
    const closeOverlay = mock();
    let lastSelector: ReturnType<typeof createSelector> | null = null;
    const createSelectorSpy = mock(() => {
      lastSelector = createSelector();
      return lastSelector;
    });
    const spawnCommand = mock();

    const { runLocalShellLine } = createLocalShellRunner({
      chatLog,
      tui,
      openOverlay,
      closeOverlay,
      createSelector: createSelectorSpy,
      spawnCommand,
    });

    const firstRun = runLocalShellLine("!ls");
    expect(openOverlay).toHaveBeenCalledTimes(1);
    lastSelector?.onSelect?.({ value: "no", label: "No" });
    await firstRun;

    await runLocalShellLine("!pwd");

    expect(messages).toContain("local shell: not enabled");
    expect(messages).toContain("local shell: not enabled for this session");
    expect(createSelectorSpy).toHaveBeenCalledTimes(1);
    expect(spawnCommand).not.toHaveBeenCalled();
  });
});
