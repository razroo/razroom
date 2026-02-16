import process from "node:process";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const tryRouteCliMock = vi.hoisted(() => mock());
const loadDotEnvMock = vi.hoisted(() => mock());
const normalizeEnvMock = vi.hoisted(() => mock());
const ensurePathMock = vi.hoisted(() => mock());
const assertRuntimeMock = vi.hoisted(() => mock());

mock("./route.js", () => ({
  tryRouteCli: tryRouteCliMock,
}));

mock("../infra/dotenv.js", () => ({
  loadDotEnv: loadDotEnvMock,
}));

mock("../infra/env.js", () => ({
  normalizeEnv: normalizeEnvMock,
}));

mock("../infra/path-env.js", () => ({
  ensureOpenClawCliOnPath: ensurePathMock,
}));

mock("../infra/runtime-guard.js", () => ({
  assertSupportedRuntime: assertRuntimeMock,
}));

const { runCli } = await import("./run-main.js");

describe("runCli exit behavior", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("does not force process.exit after successful routed command", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);
    const exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`unexpected process.exit(${String(code)})`);
    }) as typeof process.exit);

    await runCli(["node", "openclaw", "status"]);

    expect(tryRouteCliMock).toHaveBeenCalledWith(["node", "openclaw", "status"]);
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
