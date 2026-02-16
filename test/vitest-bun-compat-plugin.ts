/**
 * Vitest plugin that rewrites bun:test patterns so vitest can handle them:
 *
 * 1. Top-level `mock("module-path", ...)` → `vi.mock("module-path", ...)`
 *    so vitest's hoister picks them up for module mocking.
 *
 * 2. Injects a hoisted `mock` binding so `mock()` calls inside
 *    `vi.hoisted()` callbacks resolve to `vi.fn()`.
 */
import type { Plugin } from "vite";

/**
 * Match top-level `mock("..." ...` that look like module-mocking calls.
 * Only rewrite when the first argument is a string literal that looks
 * like a module specifier (contains "/" or starts with "node:").
 */
const MODULE_MOCK_RE = /^(mock\(["'](?:[^"']*\/[^"']*|node:[^"']+)["'])/gm;

/**
 * Early-binding injection: ensures `mock` is available as `vi.fn` before
 * any imports, so `vi.hoisted(() => mock(...))` patterns work.
 */
const MOCK_INJECTION = `const { mock: mock } = vi.hoisted(() => ({ mock: (...args) => vi.fn(...args) }));\n`;

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

      // Remove `mock` from the bun:test import (we inject it via vi.hoisted
      // so it's available before imports — critical for vi.hoisted callbacks).
      transformed = transformed.replace(
        /import\s*\{([^}]*)\}\s*from\s*["']bun:test["']/g,
        (match, imports: string) => {
          const parts = imports
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
          const withoutMock = parts.filter(
            (p: string) => p !== "mock" && !p.startsWith("mock ") && !p.startsWith("mock,"),
          );
          const hadMock = withoutMock.length < parts.length;
          if (!hadMock) {
            return match;
          }
          if (withoutMock.length === 0) {
            // All imports were `mock`; keep the import for side effects
            return `import {} from "bun:test"`;
          }
          return `import { ${withoutMock.join(", ")} } from "bun:test"`;
        },
      );

      // Inject the hoisted mock binding at the top of the file
      if (code.includes("mock")) {
        transformed = MOCK_INJECTION + transformed;
      }

      if (transformed === code) {
        return null;
      }
      return { code: transformed, map: null };
    },
  };
}
