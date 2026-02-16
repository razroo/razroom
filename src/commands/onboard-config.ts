import type { RazroomConfig } from "../config/config.js";

export function applyOnboardingLocalWorkspaceConfig(
  baseConfig: RazroomConfig,
  workspaceDir: string,
): RazroomConfig {
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
  };
}
