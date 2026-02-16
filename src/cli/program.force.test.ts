import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return {
    ...actual,
    execFileSync: mock(),
  };
});

import { execFileSync } from "node:child_process";
import {
  forceFreePort,
  forceFreePortAndWait,
  listPortListeners,
  type PortProcess,
  parseLsofOutput,
} from "./ports.js";

describe("gateway --force helpers", () => {
  let originalKill: typeof process.kill;

  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
    originalKill = process.kill.bind(process);
  });

  afterEach(() => {
    process.kill = originalKill;
  });

  it("parses lsof output into pid/command pairs", () => {
    const sample = ["p123", "cnode", "p456", "cpython", ""].join("\n");
    const parsed = parseLsofOutput(sample);
    expect(parsed).toEqual<PortProcess[]>([
      { pid: 123, command: "node" },
      { pid: 456, command: "python" },
    ]);
  });

  it("returns empty list when lsof finds nothing", () => {
    (execFileSync as unknown as vi.Mock).mockImplementation(() => {
      const err = new Error("no matches");
      // @ts-expect-error partial
      err.status = 1; // lsof uses exit 1 for no matches
      throw err;
    });
    expect(listPortListeners(18789)).toEqual([]);
  });

  it("throws when lsof missing", () => {
    (execFileSync as unknown as vi.Mock).mockImplementation(() => {
      const err = new Error("not found");
      // @ts-expect-error partial
      err.code = "ENOENT";
      throw err;
    });
    expect(() => listPortListeners(18789)).toThrow(/lsof not found/);
  });

  it("kills each listener and returns metadata", () => {
    (execFileSync as unknown as vi.Mock).mockReturnValue(
      ["p42", "cnode", "p99", "cssh", ""].join("\n"),
    );
    const killMock = mock();
    // @ts-expect-error override for test
    process.kill = killMock;

    const killed = forceFreePort(18789);

    expect(execFileSync).toHaveBeenCalled();
    expect(killMock).toHaveBeenCalledTimes(2);
    expect(killMock).toHaveBeenCalledWith(42, "SIGTERM");
    expect(killMock).toHaveBeenCalledWith(99, "SIGTERM");
    expect(killed).toEqual<PortProcess[]>([
      { pid: 42, command: "node" },
      { pid: 99, command: "ssh" },
    ]);
  });

  it("retries until the port is free", async () => {
    // TODO: Implement fake timers for Bun;
    let call = 0;
    (execFileSync as unknown as vi.Mock).mockImplementation(() => {
      call += 1;
      // 1st call: initial listeners to kill; 2nd call: still listed; 3rd call: gone.
      if (call === 1) {
        return ["p42", "cnode", ""].join("\n");
      }
      if (call === 2) {
        return ["p42", "cnode", ""].join("\n");
      }
      return "";
    });

    const killMock = mock();
    // @ts-expect-error override for test
    process.kill = killMock;

    const promise = forceFreePortAndWait(18789, {
      timeoutMs: 500,
      intervalMs: 100,
      sigtermTimeoutMs: 400,
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    expect(killMock).toHaveBeenCalledWith(42, "SIGTERM");
    expect(res.killed).toEqual<PortProcess[]>([{ pid: 42, command: "node" }]);
    expect(res.escalatedToSigkill).toBe(false);
    expect(res.waitedMs).toBeGreaterThan(0);

    // TODO: Restore real timers;
  });

  it("escalates to SIGKILL if SIGTERM doesn't free the port", async () => {
    // TODO: Implement fake timers for Bun;
    let call = 0;
    (execFileSync as unknown as vi.Mock).mockImplementation(() => {
      call += 1;
      // 1st call: initial kill list; then keep showing until after SIGKILL.
      if (call <= 6) {
        return ["p42", "cnode", ""].join("\n");
      }
      return "";
    });

    const killMock = mock();
    // @ts-expect-error override for test
    process.kill = killMock;

    const promise = forceFreePortAndWait(18789, {
      timeoutMs: 800,
      intervalMs: 100,
      sigtermTimeoutMs: 300,
    });

    await vi.runAllTimersAsync();
    const res = await promise;

    expect(killMock).toHaveBeenCalledWith(42, "SIGTERM");
    expect(killMock).toHaveBeenCalledWith(42, "SIGKILL");
    expect(res.escalatedToSigkill).toBe(true);

    // TODO: Restore real timers;
  });
});
