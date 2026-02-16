import { describe, expect, test } from "bun:test";
import { formatError } from "./server-utils.js";

describe("formatError", () => {
  test("prefers message for Error", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
  });

  test("handles status/code", () => {
    expect(formatError({ status: 500, code: "EPIPE" })).toBe("status=500 code=EPIPE");
    expect(formatError({ status: 404 })).toBe("status=404 code=unknown");
    expect(formatError({ code: "ENOENT" })).toBe("status=unknown code=ENOENT");
  });
});
