#!/usr/bin/env bun
// Bun build script for Vitamin
// Replaces tsdown bundler

import { build, Glob } from "bun";
import { mkdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { buildConfig, type BuildEntry } from "../bun-build.config";

// Resolve glob patterns to actual file paths
async function resolveGlobs(patterns: string[]): Promise<string[]> {
  const resolved: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      // Use Bun's Glob to resolve
      const glob = new Glob(pattern);
      for await (const file of glob.scan(".")) {
        resolved.push(file);
      }
    } else {
      resolved.push(pattern);
    }
  }

  return resolved;
}

// Build a single entry
async function buildEntry(entry: BuildEntry): Promise<void> {
  const entries = Array.isArray(entry.entry) ? entry.entry : [entry.entry];
  const resolvedEntries = await resolveGlobs(entries);

  console.log(`Building ${resolvedEntries.length} entry points...`);

  for (const entryPoint of resolvedEntries) {
    const outdir = entry.outDir || "dist";

    // For plugin-sdk, output directly to the specified outdir
    const relativePath = entryPoint.replace(/^src\//, "");
    const isPluginSdk = entry.outDir === "dist/plugin-sdk";
    const finalPath = isPluginSdk
      ? join(outdir, basename(entryPoint, ".ts") + ".js")
      : join(outdir, dirname(relativePath), basename(entryPoint, ".ts") + ".js");

    // Ensure output directory exists
    const outDirPath = dirname(finalPath);
    if (!existsSync(outDirPath)) {
      mkdirSync(outDirPath, { recursive: true });
    }

    console.log(`  ${entryPoint} -> ${finalPath}`);

    try {
      // Read package.json to get list of dependencies
      const packageJson = JSON.parse(await Bun.file("package.json").text());
      const deps = [
        ...Object.keys(packageJson.dependencies || {}),
        ...Object.keys(packageJson.devDependencies || {}),
        ...Object.keys(packageJson.peerDependencies || {}),
      ];

      const result = await build({
        entrypoints: [entryPoint],
        outdir: outDirPath,
        target: entry.platform === "bun" ? "bun" : "node",
        format: "esm",
        splitting: false,
        minify: false,
        sourcemap: "external",
        naming: basename(entryPoint, ".ts") + ".js",
        define: entry.env || {},
        // Externalize all dependencies and built-in modules
        external: [...deps, "node:*", "bun:*"],
      });

      if (!result.success) {
        console.error(`Failed to build ${entryPoint}`);
        for (const log of result.logs) {
          console.error(log);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error building ${entryPoint}:`, err);
      process.exit(1);
    }
  }
}

// Main build function
async function main() {
  console.log("🔨 Building Vitamin with Bun...\n");

  const startTime = performance.now();

  try {
    // Build all entries from config
    for (const entry of buildConfig) {
      await buildEntry(entry);
    }

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Build completed successfully in ${duration}s`);
  } catch (err) {
    console.error("\n❌ Build failed:", err);
    process.exit(1);
  }
}

main();
