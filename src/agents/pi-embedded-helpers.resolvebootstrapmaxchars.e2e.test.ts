import { describe, expect, it } from "bun:test";
import type { MoltBotConfig } from "../config/config.js";
import {
  DEFAULT_BOOTSTRAP_MAX_CHARS,
  DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS,
  resolveBootstrapMaxChars,
  resolveBootstrapTotalMaxChars,
} from "./pi-embedded-helpers.js";

describe("resolveBootstrapMaxChars", () => {
  it("returns default when unset", () => {
    expect(resolveBootstrapMaxChars()).toBe(DEFAULT_BOOTSTRAP_MAX_CHARS);
  });

  it("uses configured value when valid", () => {
    const cfg = {
      agents: { defaults: { bootstrapMaxChars: 12345 } },
    } as MoltBotConfig;
    expect(resolveBootstrapMaxChars(cfg)).toBe(12345);
  });

  it("falls back when invalid", () => {
    const cfg = {
      agents: { defaults: { bootstrapMaxChars: -1 } },
    } as MoltBotConfig;
    expect(resolveBootstrapMaxChars(cfg)).toBe(DEFAULT_BOOTSTRAP_MAX_CHARS);
  });
});

describe("resolveBootstrapTotalMaxChars", () => {
  it("returns default when unset", () => {
    expect(resolveBootstrapTotalMaxChars()).toBe(DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS);
  });

  it("uses configured value when valid", () => {
    const cfg = {
      agents: { defaults: { bootstrapTotalMaxChars: 54321 } },
    } as MoltBotConfig;
    expect(resolveBootstrapTotalMaxChars(cfg)).toBe(54321);
  });

  it("falls back when invalid", () => {
    const cfg = {
      agents: { defaults: { bootstrapTotalMaxChars: -1 } },
    } as MoltBotConfig;
    expect(resolveBootstrapTotalMaxChars(cfg)).toBe(DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS);
  });
});
