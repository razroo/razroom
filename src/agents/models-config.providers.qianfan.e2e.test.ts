import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { resolveImplicitProviders } from "./models-config.providers.js";

describe("Qianfan provider", () => {
  it("should include qianfan when QIANFAN_API_KEY is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "moltbot-test-"));
    const previous = process.env.QIANFAN_API_KEY;
    process.env.QIANFAN_API_KEY = "test-key";

    try {
      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.qianfan).toBeDefined();
      expect(providers?.qianfan?.apiKey).toBe("QIANFAN_API_KEY");
    } finally {
      if (previous === undefined) {
        delete process.env.QIANFAN_API_KEY;
      } else {
        process.env.QIANFAN_API_KEY = previous;
      }
    }
  });
});
