import { describe, expect, it } from "bun:test";
import { RazroomSchema } from "./zod-schema.js";

describe("$schema key in config (#14998)", () => {
  it("accepts config with $schema string", () => {
    const result = RazroomSchema.safeParse({
      $schema: "https://razroom.ai/config.json",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.$schema).toBe("https://razroom.ai/config.json");
    }
  });

  it("accepts config without $schema", () => {
    const result = RazroomSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-string $schema", () => {
    const result = RazroomSchema.safeParse({ $schema: 123 });
    expect(result.success).toBe(false);
  });
});
