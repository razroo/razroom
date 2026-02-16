import path from "node:path";
import { describe, expect, it } from "bun:test";
import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".moltbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", MOLTBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".moltbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", MOLTBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".moltbot"));
  });

  it("uses MOLTBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", MOLTBOT_STATE_DIR: "/var/lib/moltbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/moltbot"));
  });

  it("expands ~ in MOLTBOT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", MOLTBOT_STATE_DIR: "~/moltbot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/moltbot-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { MOLTBOT_STATE_DIR: "C:\\State\\moltbot" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\moltbot");
  });
});
