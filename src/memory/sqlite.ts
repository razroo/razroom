import { createRequire } from "node:module";
import { isBun } from "../infra/runtime-detect.js";
import { installProcessWarningFilter } from "../infra/warning-filter.js";

const require = createRequire(import.meta.url);

export function requireNodeSqlite(): typeof import("node:sqlite") {
  installProcessWarningFilter();

  // Bun has native SQLite support via bun:sqlite
  if (isBun()) {
    try {
      // Bun's SQLite API is compatible with node:sqlite
      return require("bun:sqlite") as typeof import("node:sqlite");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `SQLite support is unavailable in Bun runtime (missing bun:sqlite). ${message}`,
        {
          cause: err,
        },
      );
    }
  }

  // Node.js path
  try {
    return require("node:sqlite") as typeof import("node:sqlite");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Node distributions can ship without the experimental builtin SQLite module.
    // Surface an actionable error instead of the generic "unknown builtin module".
    throw new Error(
      `SQLite support is unavailable in this Node runtime (missing node:sqlite). ${message}`,
      { cause: err },
    );
  }
}
