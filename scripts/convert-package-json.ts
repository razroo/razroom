#!/usr/bin/env bun
// Script to convert package.json scripts from Node/pnpm to Bun

import { readFileSync, writeFileSync } from "fs";

const packageJsonPath = "package.json";
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

// Convert scripts
const scripts = pkg.scripts || {};
const newScripts: Record<string, string> = {};

// Remove native app scripts
const skipScripts = [
  "android:assemble",
  "android:install",
  "android:run",
  "android:test",
  "ios:build",
  "ios:gen",
  "ios:open",
  "ios:run",
  "mac:open",
  "mac:package",
  "mac:restart",
  "format:swift",
  "lint:swift",
  "protocol:gen:swift",
];

for (const [key, value] of Object.entries(scripts)) {
  if (skipScripts.includes(key)) {
    console.log(`Skipping: ${key}`);
    continue;
  }

  let newValue = value as string;

  // Replace node --import tsx with bun
  newValue = newValue.replace(/node --import tsx /g, "bun ");

  // Replace node scripts/ with bun scripts/
  newValue = newValue.replace(/node scripts\//g, "bun scripts/");

  // Replace pnpm with bun run
  newValue = newValue.replace(/pnpm /g, "bun run ");

  // Replace tsdown with bun scripts/build.ts
  newValue = newValue.replace(/tsdown/g, "bun scripts/build.ts");

  // Replace pnpm dlx with bunx
  newValue = newValue.replace(/bun run dlx /g, "bunx ");

  // Replace pnpm --dir with bun --cwd
  newValue = newValue.replace(/bun run --dir /g, "bun --cwd ");

  // Replace vitest with bun test for test commands
  if (key.startsWith("test") && !key.includes("docker")) {
    newValue = newValue.replace(/vitest run /g, "bun test ");
    newValue = newValue.replace(/vitest$/g, "bun test --watch");
  }

  // Update scripts/run-node.mjs to run-bun.mjs
  newValue = newValue.replace(/run-node\.mjs/g, "run-bun.mjs");
  newValue = newValue.replace(/watch-node\.mjs/g, "watch-bun.mjs");

  newScripts[key] = newValue;
}

pkg.scripts = newScripts;

// Write back
writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

console.log("\n✅ Package.json scripts converted successfully!");
console.log(`Removed ${skipScripts.length} native app scripts`);
console.log(`Updated ${Object.keys(newScripts).length} scripts for Bun`);
