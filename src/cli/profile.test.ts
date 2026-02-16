import { describe, expect, it } from "bun:test";
import path from "node:path";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "razroom",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "razroom", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "razroom", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "razroom", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "razroom", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "razroom", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "razroom", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "razroom", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "razroom", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".razroom-dev");
    expect(env.RAZROOM_PROFILE).toBe("dev");
    expect(env.RAZROOM_STATE_DIR).toBe(expectedStateDir);
    expect(env.RAZROOM_CONFIG_PATH).toBe(path.join(expectedStateDir, "razroom.json"));
    expect(env.RAZROOM_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      RAZROOM_STATE_DIR: "/custom",
      RAZROOM_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.RAZROOM_STATE_DIR).toBe("/custom");
    expect(env.RAZROOM_GATEWAY_PORT).toBe("19099");
    expect(env.RAZROOM_CONFIG_PATH).toBe(path.join("/custom", "razroom.json"));
  });

  it("uses RAZROOM_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      RAZROOM_HOME: "/srv/razroom-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/razroom-home");
    expect(env.RAZROOM_STATE_DIR).toBe(path.join(resolvedHome, ".razroom-work"));
    expect(env.RAZROOM_CONFIG_PATH).toBe(path.join(resolvedHome, ".razroom-work", "razroom.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("razroom doctor --fix", {})).toBe("razroom doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("razroom doctor --fix", { RAZROOM_PROFILE: "default" })).toBe(
      "razroom doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("razroom doctor --fix", { RAZROOM_PROFILE: "Default" })).toBe(
      "razroom doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("razroom doctor --fix", { RAZROOM_PROFILE: "bad profile" })).toBe(
      "razroom doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("razroom --profile work doctor --fix", { RAZROOM_PROFILE: "work" }),
    ).toBe("razroom --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("razroom --dev doctor", { RAZROOM_PROFILE: "dev" })).toBe(
      "razroom --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("razroom doctor --fix", { RAZROOM_PROFILE: "work" })).toBe(
      "razroom --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("razroom doctor --fix", { RAZROOM_PROFILE: "  jbrazroom  " })).toBe(
      "razroom --profile jbrazroom doctor --fix",
    );
  });

  it("handles command with no args after razroom", () => {
    expect(formatCliCommand("razroom", { RAZROOM_PROFILE: "test" })).toBe("razroom --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm razroom doctor", { RAZROOM_PROFILE: "work" })).toBe(
      "pnpm razroom --profile work doctor",
    );
  });
});
