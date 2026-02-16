import { describe, expect, it } from "bun:test";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "razroom", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "razroom", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "razroom", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "razroom", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "razroom", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "razroom", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "razroom", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "razroom"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "razroom", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "razroom", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "razroom", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "razroom", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "razroom", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "razroom", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "razroom", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "razroom", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "razroom", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "razroom", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "razroom", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "razroom", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "razroom", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "razroom", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["node", "razroom", "status"],
    });
    expect(nodeArgv).toEqual(["node", "razroom", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["node-22", "razroom", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "razroom", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["node-22.2.0.exe", "razroom", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "razroom", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["node-22.2", "razroom", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "razroom", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["node-22.2.exe", "razroom", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "razroom", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["/usr/bin/node-22.2.0", "razroom", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "razroom", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["nodejs", "razroom", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "razroom", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["node-dev", "razroom", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "razroom", "node-dev", "razroom", "status"]);

    const directArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["razroom", "status"],
    });
    expect(directArgv).toEqual(["node", "razroom", "status"]);

    const bunArgv = buildParseArgv({
      programName: "razroom",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "razroom",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "razroom", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "razroom", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "config", "get", "update"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "config", "unset", "update"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "models", "list"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "models", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "razroom", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "razroom", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["config", "get"])).toBe(false);
    expect(shouldMigrateStateFromPath(["models", "status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
