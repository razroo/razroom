import { describe, expect, it, mock, spyOn } from "bun:test";
import type { RuntimeEnv } from "../runtime.js";

const mocks = vi.hoisted(() => ({
  text: mock(),
  select: mock(),
  confirm: mock(),
  resolveGatewayPort: mock(),
  buildGatewayAuthConfig: mock(),
  note: mock(),
  randomToken: mock(),
}));

mock("../config/config.js", async (importActual) => {
  const actual = await importActual<typeof import("../config/config.js")>();
  return {
    ...actual,
    resolveGatewayPort: mocks.resolveGatewayPort,
  };
});

mock("./configure.shared.js", () => ({
  text: mocks.text,
  select: mocks.select,
  confirm: mocks.confirm,
}));

mock("../terminal/note.js", () => ({
  note: mocks.note,
}));

mock("./configure.gateway-auth.js", () => ({
  buildGatewayAuthConfig: mocks.buildGatewayAuthConfig,
}));

mock("../infra/tailscale.js", () => ({
  findTailscaleBinary: mock(async () => undefined),
}));

mock("./onboard-helpers.js", async (importActual) => {
  const actual = await importActual<typeof import("./onboard-helpers.js")>();
  return {
    ...actual,
    randomToken: mocks.randomToken,
  };
});

import { promptGatewayConfig } from "./configure.gateway.js";

describe("promptGatewayConfig", () => {
  it("generates a token when the prompt returns undefined", async () => {
    mocks.resolveGatewayPort.mockReturnValue(18789);
    const selectQueue = ["loopback", "token", "off"];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    const textQueue = ["18789", undefined];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.randomToken.mockReturnValue("generated-token");
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, token, password }) => ({
      mode,
      token,
      password,
    }));

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    const result = await promptGatewayConfig({}, runtime);
    expect(result.token).toBe("generated-token");
  });
  it("does not set password to literal 'undefined' when prompt returns undefined", async () => {
    // mock.restore() // TODO: Review mock cleanup;
    mocks.resolveGatewayPort.mockReturnValue(18789);
    // Flow: loopback bind → password auth → tailscale off
    const selectQueue = ["loopback", "password", "off"];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    // Port prompt → OK, then password prompt → returns undefined (simulating prompter edge case)
    const textQueue = ["18789", undefined];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.randomToken.mockReturnValue("unused");
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, token, password }) => ({
      mode,
      token,
      password,
    }));

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    await promptGatewayConfig({}, runtime);
    const call = mocks.buildGatewayAuthConfig.mock.calls[0]?.[0];
    expect(call?.password).not.toBe("undefined");
    expect(call?.password).toBe("");
  });

  it("prompts for trusted-proxy configuration when trusted-proxy mode selected", async () => {
    // mock.restore() // TODO: Review mock cleanup;
    mocks.resolveGatewayPort.mockReturnValue(18789);
    // Flow: loopback bind → trusted-proxy auth → tailscale off
    const selectQueue = ["loopback", "trusted-proxy", "off"];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    // Port prompt, userHeader, requiredHeaders, allowUsers, trustedProxies
    const textQueue = [
      "18789",
      "x-forwarded-user",
      "x-forwarded-proto,x-forwarded-host",
      "nick@example.com",
      "10.0.1.10,192.168.1.5",
    ];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, trustedProxy }) => ({
      mode,
      trustedProxy,
    }));

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    const result = await promptGatewayConfig({}, runtime);
    const call = mocks.buildGatewayAuthConfig.mock.calls[0]?.[0];

    expect(call?.mode).toBe("trusted-proxy");
    expect(call?.trustedProxy).toEqual({
      userHeader: "x-forwarded-user",
      requiredHeaders: ["x-forwarded-proto", "x-forwarded-host"],
      allowUsers: ["nick@example.com"],
    });
    expect(result.config.gateway?.bind).toBe("lan");
    expect(result.config.gateway?.trustedProxies).toEqual(["10.0.1.10", "192.168.1.5"]);
  });

  it("handles trusted-proxy with no optional fields", async () => {
    // mock.restore() // TODO: Review mock cleanup;
    mocks.resolveGatewayPort.mockReturnValue(18789);
    const selectQueue = ["loopback", "trusted-proxy", "off"];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    // Port prompt, userHeader (only required), empty requiredHeaders, empty allowUsers, trustedProxies
    const textQueue = ["18789", "x-remote-user", "", "", "10.0.0.1"];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, trustedProxy }) => ({
      mode,
      trustedProxy,
    }));

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    const result = await promptGatewayConfig({}, runtime);
    const call = mocks.buildGatewayAuthConfig.mock.calls[0]?.[0];

    expect(call?.mode).toBe("trusted-proxy");
    expect(call?.trustedProxy).toEqual({
      userHeader: "x-remote-user",
      // requiredHeaders and allowUsers should be undefined when empty
    });
    expect(result.config.gateway?.bind).toBe("lan");
    expect(result.config.gateway?.trustedProxies).toEqual(["10.0.0.1"]);
  });

  it("forces tailscale off when trusted-proxy is selected", async () => {
    // mock.restore() // TODO: Review mock cleanup;
    mocks.resolveGatewayPort.mockReturnValue(18789);
    const selectQueue = ["loopback", "trusted-proxy", "serve"];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    const textQueue = ["18789", "x-forwarded-user", "", "", "10.0.0.1"];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.confirm.mockResolvedValue(true);
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, trustedProxy }) => ({
      mode,
      trustedProxy,
    }));

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    const result = await promptGatewayConfig({}, runtime);
    expect(result.config.gateway?.bind).toBe("lan");
    expect(result.config.gateway?.tailscale?.mode).toBe("off");
    expect(result.config.gateway?.tailscale?.resetOnExit).toBe(false);
  });
});
