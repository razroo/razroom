import { describe, expect, it } from "bun:test";
import { runCommandWithTimeout, shouldSpawnWithShell } from "./exec.js";

describe("runCommandWithTimeout", () => {
  it("never enables shell execution (Windows cmd.exe injection hardening)", () => {
    expect(
      shouldSpawnWithShell({
        resolvedCommand: "npm.cmd",
        platform: "win32",
      }),
    ).toBe(false);
  });

  it("passes env overrides to child", async () => {
    const result = await runCommandWithTimeout(
      [process.execPath, "-e", 'process.stdout.write(process.env.MOLTBOT_TEST_ENV ?? "")'],
      {
        timeoutMs: 5_000,
        env: { MOLTBOT_TEST_ENV: "ok" },
      },
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("merges custom env with process.env", async () => {
    const previous = process.env.MOLTBOT_BASE_ENV;
    process.env.MOLTBOT_BASE_ENV = "base";
    try {
      const result = await runCommandWithTimeout(
        [
          process.execPath,
          "-e",
          'process.stdout.write((process.env.MOLTBOT_BASE_ENV ?? "") + "|" + (process.env.MOLTBOT_TEST_ENV ?? ""))',
        ],
        {
          timeoutMs: 5_000,
          env: { MOLTBOT_TEST_ENV: "ok" },
        },
      );

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("base|ok");
    } finally {
      if (previous === undefined) {
        delete process.env.MOLTBOT_BASE_ENV;
      } else {
        process.env.MOLTBOT_BASE_ENV = previous;
      }
    }
  });
});
