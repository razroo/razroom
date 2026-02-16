import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import path from "node:path";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses RAZROOM_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "razroom-home");
    vi.stubEnv("RAZROOM_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".razroom", "workspace"),
    );
  });
});
