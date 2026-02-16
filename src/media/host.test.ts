import type { Server } from "node:http";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import fs from "node:fs/promises";

const mocks = vi.hoisted(() => ({
  saveMediaSource: mock(),
  getTailnetHostname: mock(),
  ensurePortAvailable: mock(),
  startMediaServer: mock(),
  logInfo: mock(),
}));
const { saveMediaSource, getTailnetHostname, ensurePortAvailable, startMediaServer, logInfo } =
  mocks;

mock("./store.js", () => ({ saveMediaSource }));
mock("../infra/tailscale.js", () => ({ getTailnetHostname }));
mock("../infra/ports.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/ports.js")>("../infra/ports.js");
  return { ensurePortAvailable, PortInUseError: actual.PortInUseError };
});
mock("./server.js", () => ({ startMediaServer }));
mock("../logger.js", async () => {
  const actual = await vi.importActual<typeof import("../logger.js")>("../logger.js");
  return { ...actual, logInfo };
});

const { ensureMediaHosted } = await import("./host.js");
const { PortInUseError } = await import("../infra/ports.js");

describe("ensureMediaHosted", () => {
  beforeEach(() => {
    saveMediaSource.mockReset();
    getTailnetHostname.mockReset();
    ensurePortAvailable.mockReset();
    startMediaServer.mockReset();
    logInfo.mockReset();
  });

  it("throws and cleans up when server not allowed to start", async () => {
    saveMediaSource.mockResolvedValue({
      id: "id1",
      path: "/tmp/file1",
      size: 5,
    });
    getTailnetHostname.mockResolvedValue("tailnet-host");
    ensurePortAvailable.mockResolvedValue(undefined);
    const rmSpy = spyOn(fs, "rm").mockResolvedValue(undefined);

    await expect(ensureMediaHosted("/tmp/file1", { startServer: false })).rejects.toThrow(
      "requires the webhook/Funnel server",
    );
    expect(rmSpy).toHaveBeenCalledWith("/tmp/file1");
    rmSpy.mockRestore();
  });

  it("starts media server when allowed", async () => {
    saveMediaSource.mockResolvedValue({
      id: "id2",
      path: "/tmp/file2",
      size: 9,
    });
    getTailnetHostname.mockResolvedValue("tail.net");
    ensurePortAvailable.mockResolvedValue(undefined);
    const fakeServer = { unref: mock() } as unknown as Server;
    startMediaServer.mockResolvedValue(fakeServer);

    const result = await ensureMediaHosted("/tmp/file2", {
      startServer: true,
      port: 1234,
    });
    expect(startMediaServer).toHaveBeenCalledWith(1234, expect.any(Number), expect.anything());
    expect(logInfo).toHaveBeenCalled();
    expect(result).toEqual({
      url: "https://tail.net/media/id2",
      id: "id2",
      size: 9,
    });
  });

  it("skips server start when port already in use", async () => {
    saveMediaSource.mockResolvedValue({
      id: "id3",
      path: "/tmp/file3",
      size: 7,
    });
    getTailnetHostname.mockResolvedValue("tail.net");
    ensurePortAvailable.mockRejectedValue(new PortInUseError(3000, "proc"));

    const result = await ensureMediaHosted("/tmp/file3", {
      startServer: false,
      port: 3000,
    });
    expect(startMediaServer).not.toHaveBeenCalled();
    expect(result.url).toBe("https://tail.net/media/id3");
  });
});
