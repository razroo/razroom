// Bun build configuration for Vitamin
// Replaces tsdown.config.ts

export interface BuildEntry {
  entry: string | string[];
  outDir?: string;
  env?: Record<string, string>;
  platform?: "node" | "bun" | "browser";
}

const env = {
  NODE_ENV: "production",
};

export const buildConfig: BuildEntry[] = [
  {
    entry: "src/index.ts",
    env,
    platform: "bun",
  },
  {
    entry: "src/entry.ts",
    env,
    platform: "bun",
  },
  {
    // Ensure this module is bundled as an entry so legacy CLI shims can resolve its exports.
    entry: "src/cli/daemon-cli.ts",
    env,
    platform: "bun",
  },
  {
    entry: "src/infra/warning-filter.ts",
    env,
    platform: "bun",
  },
  {
    entry: "src/plugin-sdk/index.ts",
    outDir: "dist/plugin-sdk",
    env,
    platform: "bun",
  },
  {
    entry: "src/plugin-sdk/account-id.ts",
    outDir: "dist/plugin-sdk",
    env,
    platform: "bun",
  },
  {
    entry: "src/extensionAPI.ts",
    env,
    platform: "bun",
  },
  {
    entry: ["src/hooks/bundled/*/handler.ts", "src/hooks/llm-slug-generator.ts"],
    env,
    platform: "bun",
  },
];

export default buildConfig;
