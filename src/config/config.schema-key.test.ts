import { describe, expect, it } from "bun:test";
import { MoltBotSchema } from "./zod-schema.js";

describe("$schema key in config (#14998)", () => {
  it("accepts config with $schema string", () => {
    const result = MoltBotSchema.safeParse({
      $schema: "https://moltbot.ai/config.json",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.$schema).toBe("https://moltbot.ai/config.json");
    }
  });

  it("accepts config without $schema", () => {
    const result = MoltBotSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-string $schema", () => {
    const result = MoltBotSchema.safeParse({ $schema: 123 });
    expect(result.success).toBe(false);
  });
});
