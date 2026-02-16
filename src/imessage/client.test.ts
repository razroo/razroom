import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const spawnMock = vi.hoisted(() => mock());

mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe("createIMessageRpcClient", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.stubEnv("VITEST", "true");
  });

  it("refuses to spawn imsg rpc in test environments", async () => {
    const { createIMessageRpcClient } = await import("./client.js");
    await expect(createIMessageRpcClient()).rejects.toThrow(
      /Refusing to start imsg rpc in test environment/i,
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
