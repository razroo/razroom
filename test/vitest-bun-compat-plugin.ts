/**
 * Vitest plugin that rewrites bun:test patterns so vitest can handle them:
 *
 * 1. Top-level `mock("module-path", ...)` → `vi.mock("module-path", ...)`
 *    so vitest's hoister picks them up for module mocking.
 *
 * 2. `vi.hoisted(() => mock(...))` → `vi.hoisted(() => vi.fn(...))`
 *    because `mock` (from the bun:test shim) isn't available inside
 *    hoisted callbacks that run before module imports.
 */
import type { Plugin } from "vite";

/**
 * Match top-level `mock("..." ...` that look like module-mocking calls.
 * Only rewrite when the first argument is a string literal that looks
 * like a module specifier (contains "/" or starts with "node:").
 */
const MODULE_MOCK_RE = /^(mock\(["'](?:[^"']*\/[^"']*|node:[^"']+)["'])/gm;

/**
 * Match `mock()` calls inside `vi.hoisted()` callbacks and replace with `vi.fn()`.
 * These run before module imports so the bun:test shim `mock` isn't available.
 */
const HOISTED_MOCK_RE = /(vi\.hoisted\(\(\)\s*=>\s*)mock\(/g;

export function bunTestCompatPlugin(): Plugin {
  return {
    name: "vitest-bun-test-compat",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".test.ts") && !id.endsWith(".test.js")) {
        return null;
      }
      if (!code.includes('from "bun:test"')) {
        return null;
      }
      let transformed = code;
      // Replace top-level module mocking: mock("path") → vi.mock("path")
      transformed = transformed.replace(MODULE_MOCK_RE, (match) => `vi.${match}`);
      // Replace mock() inside vi.hoisted callbacks with vi.fn()
      transformed = transformed.replace(HOISTED_MOCK_RE, "$1vi.fn(");
      if (transformed === code) {
        return null;
      }
      return { code: transformed, map: null };
    },
  };
}
