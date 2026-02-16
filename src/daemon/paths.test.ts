import path from "node:path";
import { describe, expect, it } from "bun:test";
import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".razroom"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", RAZROOM_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".razroom-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", RAZROOM_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".razroom"));
  });

  it("uses RAZROOM_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", RAZROOM_STATE_DIR: "/var/lib/razroom" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/razroom"));
  });

  it("expands ~ in RAZROOM_STATE_DIR", () => {
    const env = { HOME: "/Users/test", RAZROOM_STATE_DIR: "~/razroom-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/razroom-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { RAZROOM_STATE_DIR: "C:\\State\\razroom" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\razroom");
  });
});
