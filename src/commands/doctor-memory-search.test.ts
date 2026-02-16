import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { OpenClawConfig } from "../config/config.js";

const note = vi.hoisted(() => mock());
const resolveDefaultAgentId = vi.hoisted(() => mock(() => "agent-default"));
const resolveAgentDir = vi.hoisted(() => mock(() => "/tmp/agent-default"));
const resolveMemorySearchConfig = vi.hoisted(() => mock());
const resolveApiKeyForProvider = vi.hoisted(() => mock());

mock("../terminal/note.js", () => ({
  note,
}));

mock("../agents/agent-scope.js", () => ({
  resolveDefaultAgentId,
  resolveAgentDir,
}));

mock("../agents/memory-search.js", () => ({
  resolveMemorySearchConfig,
}));

mock("../agents/model-auth.js", () => ({
  resolveApiKeyForProvider,
}));

import { noteMemorySearchHealth } from "./doctor-memory-search.js";

describe("noteMemorySearchHealth", () => {
  const cfg = {} as OpenClawConfig;

  beforeEach(() => {
    note.mockReset();
    resolveDefaultAgentId.mockClear();
    resolveAgentDir.mockClear();
    resolveMemorySearchConfig.mockReset();
    resolveApiKeyForProvider.mockReset();
  });

  it("does not warn when remote apiKey is configured for explicit provider", async () => {
    resolveMemorySearchConfig.mockReturnValue({
      provider: "openai",
      local: {},
      remote: { apiKey: "from-config" },
    });

    await noteMemorySearchHealth(cfg);

    expect(note).not.toHaveBeenCalled();
    expect(resolveApiKeyForProvider).not.toHaveBeenCalled();
  });

  it("does not warn in auto mode when remote apiKey is configured", async () => {
    resolveMemorySearchConfig.mockReturnValue({
      provider: "auto",
      local: {},
      remote: { apiKey: "from-config" },
    });

    await noteMemorySearchHealth(cfg);

    expect(note).not.toHaveBeenCalled();
    expect(resolveApiKeyForProvider).not.toHaveBeenCalled();
  });

  it("resolves provider auth from the default agent directory", async () => {
    resolveMemorySearchConfig.mockReturnValue({
      provider: "gemini",
      local: {},
      remote: {},
    });
    resolveApiKeyForProvider.mockResolvedValue({
      apiKey: "k",
      source: "env: GEMINI_API_KEY",
      mode: "api-key",
    });

    await noteMemorySearchHealth(cfg);

    expect(resolveApiKeyForProvider).toHaveBeenCalledWith({
      provider: "google",
      cfg,
      agentDir: "/tmp/agent-default",
    });
    expect(note).not.toHaveBeenCalled();
  });
});
