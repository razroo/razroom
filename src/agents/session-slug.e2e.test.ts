import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { createSessionSlug } from "./session-slug.js";

describe("session slug", () => {
  afterEach(() => {
    // TODO: Review mock restoration;
  });

  it("generates a two-word slug by default", () => {
    spyOn(Math, "random").mockReturnValue(0);
    const slug = createSessionSlug();
    expect(slug).toBe("amber-atlas");
  });

  it("adds a numeric suffix when the base slug is taken", () => {
    spyOn(Math, "random").mockReturnValue(0);
    const slug = createSessionSlug((id) => id === "amber-atlas");
    expect(slug).toBe("amber-atlas-2");
  });

  it("falls back to three words when collisions persist", () => {
    spyOn(Math, "random").mockReturnValue(0);
    const slug = createSessionSlug((id) => /^amber-atlas(-\d+)?$/.test(id));
    expect(slug).toBe("amber-atlas-atlas");
  });
});
