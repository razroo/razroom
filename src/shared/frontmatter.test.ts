import { describe, expect, test } from "bun:test";
import {
  getFrontmatterString,
  normalizeStringList,
  parseFrontmatterBool,
  resolveRazroomManifestBlock,
} from "./frontmatter.js";

describe("shared/frontmatter", () => {
  test("normalizeStringList handles strings and arrays", () => {
    expect(normalizeStringList("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(normalizeStringList([" a ", "", "b"])).toEqual(["a", "b"]);
    expect(normalizeStringList(null)).toEqual([]);
  });

  test("getFrontmatterString extracts strings only", () => {
    expect(getFrontmatterString({ a: "b" }, "a")).toBe("b");
    expect(getFrontmatterString({ a: 1 }, "a")).toBeUndefined();
  });

  test("parseFrontmatterBool respects fallback", () => {
    expect(parseFrontmatterBool("true", false)).toBe(true);
    expect(parseFrontmatterBool("false", true)).toBe(false);
    expect(parseFrontmatterBool(undefined, true)).toBe(true);
  });

  test("resolveRazroomManifestBlock parses JSON5 metadata and picks razroom block", () => {
    const frontmatter = {
      metadata: "{ razroom: { foo: 1, bar: 'baz' } }",
    };
    expect(resolveRazroomManifestBlock({ frontmatter })).toEqual({ foo: 1, bar: "baz" });
  });

  test("resolveRazroomManifestBlock returns undefined for invalid input", () => {
    expect(resolveRazroomManifestBlock({ frontmatter: {} })).toBeUndefined();
    expect(resolveRazroomManifestBlock({ frontmatter: { metadata: "not-json5" } })).toBeUndefined();
    expect(
      resolveRazroomManifestBlock({ frontmatter: { metadata: "{ nope: { a: 1 } }" } }),
    ).toBeUndefined();
  });
});
