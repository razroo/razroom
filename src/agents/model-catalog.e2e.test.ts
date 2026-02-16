import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { RazroomConfig } from "../config/config.js";
import {
  __setModelCatalogImportForTest,
  loadModelCatalog,
  resetModelCatalogCacheForTest,
} from "./model-catalog.js";

type PiSdkModule = typeof import("./pi-model-discovery.js");

mock("./models-config.js", () => ({
  ensureRazroomModelsJson: mock().mockResolvedValue({ agentDir: "/tmp", wrote: false }),
}));

mock("./agent-paths.js", () => ({
  resolveRazroomAgentDir: () => "/tmp/razroom",
}));

describe("loadModelCatalog e2e smoke", () => {
  beforeEach(() => {
    resetModelCatalogCacheForTest();
  });

  afterEach(() => {
    __setModelCatalogImportForTest();
    resetModelCatalogCacheForTest();
    // TODO: Review mock restoration;
  });

  it("recovers after an import failure on the next load", async () => {
    let call = 0;
    __setModelCatalogImportForTest(async () => {
      call += 1;
      if (call === 1) {
        throw new Error("boom");
      }
      return {
        AuthStorage: class {},
        ModelRegistry: class {
          getAll() {
            return [{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai" }];
          }
        },
      } as unknown as PiSdkModule;
    });

    const cfg = {} as RazroomConfig;
    expect(await loadModelCatalog({ config: cfg })).toEqual([]);
    expect(await loadModelCatalog({ config: cfg })).toEqual([
      { id: "gpt-4.1", name: "GPT-4.1", provider: "openai" },
    ]);
  });
});
