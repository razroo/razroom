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
 * Match top-level `mock("..." ...` module-mocking calls.
 * Keep this strict to column-0 calls so we don't rewrite local helper usage.
 */
const MODULE_MOCK_RE = /^(mock\(["'][^"']+["'])/gm;

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

      // Remove `mock` from the bun:test import and replace with
      // a vitest import that defines `mock` properly.
      let needsMockImport = false;
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
          if (hadMock) {
            needsMockImport = true;
          }
          if (!hadMock) {
            return match;
          }
          if (withoutMock.length === 0) {
            return `import {} from "bun:test"`;
          }
          return `import { ${withoutMock.join(", ")} } from "bun:test"`;
        },
      );

      // Always import vi from vitest so it's available in mock factories
      // and hoisted callbacks.
      const viImport = `import { vi } from "vitest";\n`;

      // Inject the hoisted mock binding using vi.hoisted + vi.fn.
      if (needsMockImport) {
        const injection = `const { mock: mock } = vi.hoisted(() => ({ mock: (...args) => vi.fn(...args) }));`;
        transformed = viImport + injection + "\n" + transformed;
      } else {
        transformed = viImport + transformed;
      }

      return { code: transformed, map: null };
    },
  };
}
