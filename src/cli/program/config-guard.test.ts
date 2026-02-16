import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const loadAndMaybeMigrateDoctorConfigMock = vi.hoisted(() => mock());
const readConfigFileSnapshotMock = vi.hoisted(() => mock());

mock("../../commands/doctor-config-flow.js", () => ({
  loadAndMaybeMigrateDoctorConfig: loadAndMaybeMigrateDoctorConfigMock,
}));

mock("../../config/config.js", () => ({
  readConfigFileSnapshot: readConfigFileSnapshotMock,
}));

function makeSnapshot() {
  return {
    exists: false,
    valid: true,
    issues: [],
    legacyIssues: [],
    path: "/tmp/razroom.json",
  };
}

function makeRuntime() {
  return {
    error: mock(),
    exit: mock(),
  };
}

describe("ensureConfigReady", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
    readConfigFileSnapshotMock.mockResolvedValue(makeSnapshot());
  });

  it("skips doctor flow for read-only fast path commands", async () => {
    vi.resetModules();
    const { ensureConfigReady } = await import("./config-guard.js");
    await ensureConfigReady({ runtime: makeRuntime() as never, commandPath: ["status"] });
    expect(loadAndMaybeMigrateDoctorConfigMock).not.toHaveBeenCalled();
  });

  it("runs doctor flow for commands that may mutate state", async () => {
    vi.resetModules();
    const { ensureConfigReady } = await import("./config-guard.js");
    await ensureConfigReady({ runtime: makeRuntime() as never, commandPath: ["message"] });
    expect(loadAndMaybeMigrateDoctorConfigMock).toHaveBeenCalledTimes(1);
  });
});
