import { describe, expect, it, mock, spyOn } from "bun:test";
import { createCommandHandlers } from "./tui-command-handlers.js";

describe("tui command handlers", () => {
  it("forwards unknown slash commands to the gateway", async () => {
    const sendChat = mock().mockResolvedValue({ runId: "r1" });
    const addUser = mock();
    const addSystem = mock();
    const requestRender = mock();
    const setActivityStatus = mock();

    const { handleCommand } = createCommandHandlers({
      client: { sendChat } as never,
      chatLog: { addUser, addSystem } as never,
      tui: { requestRender } as never,
      opts: {},
      state: {
        currentSessionKey: "agent:main:main",
        activeChatRunId: null,
        sessionInfo: {},
      } as never,
      deliverDefault: false,
      openOverlay: mock(),
      closeOverlay: mock(),
      refreshSessionInfo: mock(),
      loadHistory: mock(),
      setSession: mock(),
      refreshAgents: mock(),
      abortActive: mock(),
      setActivityStatus,
      formatSessionKey: mock(),
      applySessionInfoFromPatch: mock(),
      noteLocalRunId: mock(),
    });

    await handleCommand("/context");

    expect(addSystem).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/context");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/context",
      }),
    );
    expect(requestRender).toHaveBeenCalled();
  });

  it("passes reset reason when handling /new and /reset", async () => {
    const resetSession = mock().mockResolvedValue({ ok: true });
    const addSystem = mock();
    const requestRender = mock();
    const loadHistory = mock().mockResolvedValue(undefined);

    const { handleCommand } = createCommandHandlers({
      client: { resetSession } as never,
      chatLog: { addSystem } as never,
      tui: { requestRender } as never,
      opts: {},
      state: {
        currentSessionKey: "agent:main:main",
        activeChatRunId: null,
        sessionInfo: {},
      } as never,
      deliverDefault: false,
      openOverlay: mock(),
      closeOverlay: mock(),
      refreshSessionInfo: mock(),
      loadHistory,
      setSession: mock(),
      refreshAgents: mock(),
      abortActive: mock(),
      setActivityStatus: mock(),
      formatSessionKey: mock(),
      applySessionInfoFromPatch: mock(),
      noteLocalRunId: mock(),
    });

    await handleCommand("/new");
    await handleCommand("/reset");

    expect(resetSession).toHaveBeenNthCalledWith(1, "agent:main:main", "new");
    expect(resetSession).toHaveBeenNthCalledWith(2, "agent:main:main", "reset");
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });
});
