/**
 * Test: gateway_start & gateway_stop hook wiring (server.impl.ts)
 *
 * Since startGatewayServer is heavily integrated, we test the hook runner
 * calls at the unit level by verifying the hook runner functions exist
 * and validating the integration pattern.
 */
import { describe, expect, it, mock, spyOn } from "bun:test";
import { createHookRunner } from "./hooks.js";
import { createMockPluginRegistry } from "./hooks.test-helpers.js";

describe("gateway hook runner methods", () => {
  it("runGatewayStart invokes registered gateway_start hooks", async () => {
    const handler = mock();
    const registry = createMockPluginRegistry([{ hookName: "gateway_start", handler }]);
    const runner = createHookRunner(registry);

    await runner.runGatewayStart({ port: 18789 }, { port: 18789 });

    expect(handler).toHaveBeenCalledWith({ port: 18789 }, { port: 18789 });
  });

  it("runGatewayStop invokes registered gateway_stop hooks", async () => {
    const handler = mock();
    const registry = createMockPluginRegistry([{ hookName: "gateway_stop", handler }]);
    const runner = createHookRunner(registry);

    await runner.runGatewayStop({ reason: "test shutdown" }, { port: 18789 });

    expect(handler).toHaveBeenCalledWith({ reason: "test shutdown" }, { port: 18789 });
  });

  it("hasHooks returns true for registered gateway hooks", () => {
    const registry = createMockPluginRegistry([{ hookName: "gateway_start", handler: mock() }]);
    const runner = createHookRunner(registry);

    expect(runner.hasHooks("gateway_start")).toBe(true);
    expect(runner.hasHooks("gateway_stop")).toBe(false);
  });
});
