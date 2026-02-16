import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getMemorySearchManager, type MemoryIndexManager } from "./index.js";

mock("chokidar", () => ({
  default: {
    watch: mock(() => ({
      on: mock(),
      close: mock(async () => undefined),
    })),
  },
}));

mock("./embeddings.js", () => {
  return {
    createEmbeddingProvider: async () => ({
      requestedProvider: "openai",
      provider: {
        id: "mock",
        model: "mock-embed",
        embedQuery: async () => [0, 0, 0],
        embedBatch: async () => {
          throw new Error("openai embeddings failed: 400 bad request");
        },
      },
    }),
  };
});

describe("memory manager sync failures", () => {
  let workspaceDir: string;
  let indexPath: string;
  let manager: MemoryIndexManager | null = null;

  beforeEach(async () => {
    // TODO: Implement fake timers for Bun;
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "razroom-mem-"));
    indexPath = path.join(workspaceDir, "index.sqlite");
    await fs.mkdir(path.join(workspaceDir, "memory"));
    await fs.writeFile(path.join(workspaceDir, "MEMORY.md"), "Hello");
  });

  afterEach(async () => {
    // TODO: Restore real timers;
    if (manager) {
      await manager.close();
      manager = null;
    }
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("does not raise unhandledRejection when watch-triggered sync fails", async () => {
    const unhandled: unknown[] = [];
    const handler = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", handler);

    const cfg = {
      agents: {
        defaults: {
          workspace: workspaceDir,
          memorySearch: {
            provider: "openai",
            model: "mock-embed",
            store: { path: indexPath },
            sync: { watch: true, watchDebounceMs: 1, onSessionStart: false, onSearch: false },
          },
        },
        list: [{ id: "main", default: true }],
      },
    };

    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    if (!result.manager) {
      throw new Error("manager missing");
    }
    manager = result.manager;
    const syncSpy = spyOn(manager, "sync");

    // Call the internal scheduler directly; it uses fire-and-forget sync.
    (manager as unknown as { scheduleWatchSync: () => void }).scheduleWatchSync();

    await vi.runOnlyPendingTimersAsync();
    const syncPromise = syncSpy.mock.results[0]?.value as Promise<void> | undefined;
    // TODO: Restore real timers;
    if (syncPromise) {
      await syncPromise.catch(() => undefined);
    }

    process.off("unhandledRejection", handler);
    expect(unhandled).toHaveLength(0);
  });
});
