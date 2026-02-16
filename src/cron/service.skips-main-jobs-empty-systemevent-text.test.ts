import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { CronJob } from "./types.js";
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

async function waitForFirstJob(
  cron: CronService,
  predicate: (job: CronJob | undefined) => boolean,
) {
  let latest: CronJob | undefined;
  for (let i = 0; i < 30; i++) {
    const jobs = await cron.list({ includeDisabled: true });
    latest = jobs[0];
    if (predicate(latest)) {
      return latest;
    }
    await vi.runOnlyPendingTimersAsync();
  }
  return latest;
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

  it("skips main jobs with empty systemEvent text", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const requestHeartbeatNow = mock();

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: mock(async () => ({ status: "ok" })),
    });

    await cron.start();
    const atMs = Date.parse("2025-12-13T00:00:01.000Z");
    await cron.add({
      name: "empty systemEvent test",
      enabled: true,
      schedule: { kind: "at", at: new Date(atMs).toISOString() },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "   " },
    });

    vi.setSystemTime(new Date("2025-12-13T00:00:01.000Z"));
    await vi.runOnlyPendingTimersAsync();

    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    expect(requestHeartbeatNow).not.toHaveBeenCalled();

    const job = await waitForFirstJob(cron, (current) => current?.state.lastStatus === "skipped");
    expect(job?.state.lastStatus).toBe("skipped");
    expect(job?.state.lastError).toMatch(/non-empty/i);

    cron.stop();
    await store.cleanup();
  });

  it("does not schedule timers when cron is disabled", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const requestHeartbeatNow = mock();

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: false,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: mock(async () => ({ status: "ok" })),
    });

    await cron.start();
    const atMs = Date.parse("2025-12-13T00:00:01.000Z");
    await cron.add({
      name: "disabled cron job",
      enabled: true,
      schedule: { kind: "at", at: new Date(atMs).toISOString() },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "hello" },
    });

    const status = await cron.status();
    expect(status.enabled).toBe(false);
    expect(status.nextWakeAtMs).toBeNull();

    vi.setSystemTime(new Date("2025-12-13T00:00:01.000Z"));
    await vi.runOnlyPendingTimersAsync();

    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    expect(requestHeartbeatNow).not.toHaveBeenCalled();
    expect(noopLogger.warn).toHaveBeenCalled();

    cron.stop();
    await store.cleanup();
  });

  it("status reports next wake when enabled", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = mock();
    const requestHeartbeatNow = mock();

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: mock(async () => ({ status: "ok" })),
    });

    await cron.start();
    const atMs = Date.parse("2025-12-13T00:00:05.000Z");
    await cron.add({
      name: "status next wake",
      enabled: true,
      schedule: { kind: "at", at: new Date(atMs).toISOString() },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
    });

    const status = await cron.status();
    expect(status.enabled).toBe(true);
    expect(status.jobs).toBe(1);
    expect(status.nextWakeAtMs).toBe(atMs);

    cron.stop();
    await store.cleanup();
  });
});
