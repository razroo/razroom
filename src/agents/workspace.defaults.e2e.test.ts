import path from "node:path";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses MOLTBOT_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "moltbot-home");
    vi.stubEnv("MOLTBOT_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".moltbot", "workspace"),
    );
  });
});
