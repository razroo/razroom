import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const readConfigFileSnapshot = mock();
const writeConfigFile = mock().mockResolvedValue(undefined);
const loadConfig = mock().mockReturnValue({});

mock("../config/config.js", () => ({
  CONFIG_PATH: "/tmp/moltbot.json",
  readConfigFileSnapshot,
  writeConfigFile,
  loadConfig,
}));

describe("models set + fallbacks", () => {
  beforeEach(() => {
    readConfigFileSnapshot.mockReset();
    writeConfigFile.mockClear();
  });

  it("normalizes z.ai provider in models set", async () => {
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/moltbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {},
      issues: [],
      legacyIssues: [],
    });

    const runtime = { log: mock(), error: mock(), exit: mock() };
    const { modelsSetCommand } = await import("./models/set.js");

    await modelsSetCommand("z.ai/glm-4.7", runtime);

    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const written = writeConfigFile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written.agents).toEqual({
      defaults: {
        model: { primary: "zai/glm-4.7" },
        models: { "zai/glm-4.7": {} },
      },
    });
  });

  it("normalizes z-ai provider in models fallbacks add", async () => {
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/moltbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: { agents: { defaults: { model: { fallbacks: [] } } } },
      issues: [],
      legacyIssues: [],
    });

    const runtime = { log: mock(), error: mock(), exit: mock() };
    const { modelsFallbacksAddCommand } = await import("./models/fallbacks.js");

    await modelsFallbacksAddCommand("z-ai/glm-4.7", runtime);

    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const written = writeConfigFile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written.agents).toEqual({
      defaults: {
        model: { fallbacks: ["zai/glm-4.7"] },
        models: { "zai/glm-4.7": {} },
      },
    });
  });

  it("normalizes provider casing in models set", async () => {
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/moltbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {},
      issues: [],
      legacyIssues: [],
    });

    const runtime = { log: mock(), error: mock(), exit: mock() };
    const { modelsSetCommand } = await import("./models/set.js");

    await modelsSetCommand("Z.AI/glm-4.7", runtime);

    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const written = writeConfigFile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written.agents).toEqual({
      defaults: {
        model: { primary: "zai/glm-4.7" },
        models: { "zai/glm-4.7": {} },
      },
    });
  });
});
