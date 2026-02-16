import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { CronService } from "./service.js";

const noopLogger = {
  debug: mock(),
  info: mock(),
  warn: mock(),
  error: mock(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "razroom-cron-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("CronService", () => {
  beforeEach(() => {
    // TODO: Implement fake timers for Bun;
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    // TODO: Restore real timers;
  });

  it("avoids duplicate runs when two services share a store", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const requestHeartbeatNow = mock();
    const runIsolatedAgentJob = mock(async () => ({ status: "ok" }));

    const cronA = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });

    await cronA.start();
    const atMs = Date.parse("2025-12-13T00:00:01.000Z");
    await cronA.add({
      name: "shared store job",
      enabled: true,
      schedule: { kind: "at", at: new Date(atMs).toISOString() },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
    });

    const cronB = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });

    await cronB.start();

    vi.setSystemTime(new Date("2025-12-13T00:00:01.000Z"));
    await vi.runOnlyPendingTimersAsync();
    await cronA.status();
    await cronB.status();

    expect(enqueueSystemEvent).toHaveBeenCalledTimes(1);
    expect(requestHeartbeatNow).toHaveBeenCalledTimes(1);

    cronA.stop();
    cronB.stop();
    await store.cleanup();
  });
});
