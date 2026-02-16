import { Command } from "commander";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

const gatewayMocks = vi.hoisted(() => ({
  callGatewayFromCli: mock(async () => ({
    ok: true,
    format: "ai",
    targetId: "t1",
    url: "https://example.com",
    snapshot: "ok",
  })),
}));

mock("./gateway-rpc.js", () => ({
  callGatewayFromCli: gatewayMocks.callGatewayFromCli,
}));

const configMocks = vi.hoisted(() => ({
  loadConfig: mock(() => ({ browser: {} })),
}));
mock("../config/config.js", () => configMocks);

const sharedMocks = vi.hoisted(() => ({
  callBrowserRequest: mock(
    async (_opts: unknown, params: { path?: string; query?: Record<string, unknown> }) => {
      const format = params.query?.format === "aria" ? "aria" : "ai";
      if (format === "aria") {
        return {
          ok: true,
          format: "aria",
          targetId: "t1",
          url: "https://example.com",
          nodes: [],
        };
      }
      return {
        ok: true,
        format: "ai",
        targetId: "t1",
        url: "https://example.com",
        snapshot: "ok",
      };
    },
  ),
}));
mock("./browser-cli-shared.js", () => ({
  callBrowserRequest: sharedMocks.callBrowserRequest,
}));

const runtime = {
  log: mock(),
  error: mock(),
  exit: mock(),
};
mock("../runtime.js", () => ({
  defaultRuntime: runtime,
}));

describe("browser cli snapshot defaults", () => {
  afterEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
    configMocks.loadConfig.mockReturnValue({ browser: {} });
  });

  it("uses config snapshot defaults when mode is not provided", async () => {
    configMocks.loadConfig.mockReturnValue({
      browser: { snapshotDefaults: { mode: "efficient" } },
    });

    const { registerBrowserInspectCommands } = await import("./browser-cli-inspect.js");
    const program = new Command();
    const browser = program.command("browser").option("--json", false);
    registerBrowserInspectCommands(browser, () => ({}));

    await program.parseAsync(["browser", "snapshot"], { from: "user" });

    expect(sharedMocks.callBrowserRequest).toHaveBeenCalled();
    const [, params] = sharedMocks.callBrowserRequest.mock.calls.at(-1) ?? [];
    expect(params?.path).toBe("/snapshot");
    expect(params?.query).toMatchObject({
      format: "ai",
      mode: "efficient",
    });
  });

  it("does not apply config snapshot defaults to aria snapshots", async () => {
    configMocks.loadConfig.mockReturnValue({
      browser: { snapshotDefaults: { mode: "efficient" } },
    });

    gatewayMocks.callGatewayFromCli.mockResolvedValueOnce({
      ok: true,
      format: "aria",
      targetId: "t1",
      url: "https://example.com",
      nodes: [],
    });

    const { registerBrowserInspectCommands } = await import("./browser-cli-inspect.js");
    const program = new Command();
    const browser = program.command("browser").option("--json", false);
    registerBrowserInspectCommands(browser, () => ({}));

    await program.parseAsync(["browser", "snapshot", "--format", "aria"], { from: "user" });

    expect(sharedMocks.callBrowserRequest).toHaveBeenCalled();
    const [, params] = sharedMocks.callBrowserRequest.mock.calls.at(-1) ?? [];
    expect(params?.path).toBe("/snapshot");
    expect((params?.query as { mode?: unknown } | undefined)?.mode).toBeUndefined();
  });
});
