import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { MoltBotConfig } from "../../config/config.js";
import { compactEmbeddedPiSession } from "../../agents/pi-embedded.js";
import { handleCompactCommand } from "./commands-compact.js";
import { buildCommandTestParams } from "./commands.test-harness.js";

mock("../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: mock(),
  compactEmbeddedPiSession: mock(),
  isEmbeddedPiRunActive: mock().mockReturnValue(false),
  waitForEmbeddedPiRunEnd: mock().mockResolvedValue(undefined),
}));

mock("../../infra/system-events.js", () => ({
  enqueueSystemEvent: mock(),
}));

mock("./session-updates.js", () => ({
  incrementCompactionCount: mock(),
}));

describe("/compact command", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("returns null when command is not /compact", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as MoltBotConfig;
    const params = buildCommandTestParams("/status", cfg);

    const result = await handleCompactCommand(
      {
        ...params,
      },
      true,
    );

    expect(result).toBeNull();
    expect(vi.mocked(compactEmbeddedPiSession)).not.toHaveBeenCalled();
  });

  it("rejects unauthorized /compact commands", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as MoltBotConfig;
    const params = buildCommandTestParams("/compact", cfg);

    const result = await handleCompactCommand(
      {
        ...params,
        command: {
          ...params.command,
          isAuthorizedSender: false,
          senderId: "unauthorized",
        },
      },
      true,
    );

    expect(result).toEqual({ shouldContinue: false });
    expect(vi.mocked(compactEmbeddedPiSession)).not.toHaveBeenCalled();
  });

  it("routes manual compaction with explicit trigger and context metadata", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
      session: { store: "/tmp/moltbot-session-store.json" },
    } as MoltBotConfig;
    const params = buildCommandTestParams("/compact: focus on decisions", cfg, {
      From: "+15550001",
      To: "+15550002",
    });
    vi.mocked(compactEmbeddedPiSession).mockResolvedValueOnce({
      ok: true,
      compacted: false,
    });

    const result = await handleCompactCommand(
      {
        ...params,
        sessionEntry: {
          sessionId: "session-1",
          groupId: "group-1",
          groupChannel: "#general",
          space: "workspace-1",
          spawnedBy: "agent:main:parent",
          totalTokens: 12345,
        },
      },
      true,
    );

    expect(result?.shouldContinue).toBe(false);
    expect(vi.mocked(compactEmbeddedPiSession)).toHaveBeenCalledOnce();
    expect(vi.mocked(compactEmbeddedPiSession)).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        sessionKey: "agent:main:main",
        trigger: "manual",
        customInstructions: "focus on decisions",
        messageChannel: "whatsapp",
        groupId: "group-1",
        groupChannel: "#general",
        groupSpace: "workspace-1",
        spawnedBy: "agent:main:parent",
      }),
    );
  });
});
