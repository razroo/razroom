import { describe, expect, it } from "bun:test";
import {
  buildBootstrapContextFiles,
  DEFAULT_BOOTSTRAP_MAX_CHARS,
  DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS,
} from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME, type WorkspaceBootstrapFile } from "./workspace.js";

const makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});

describe("buildBootstrapContextFiles", () => {
  it("keeps missing markers", () => {
    const files = [makeFile({ missing: true, content: undefined })];
    expect(buildBootstrapContextFiles(files)).toEqual([
      {
        path: "/tmp/AGENTS.md",
        content: "[MISSING] Expected at: /tmp/AGENTS.md",
      },
    ]);
  });

  it("skips empty or whitespace-only content", () => {
    const files = [makeFile({ content: "   \n  " })];
    expect(buildBootstrapContextFiles(files)).toEqual([]);
  });

  it("truncates large bootstrap content", () => {
    const head = `HEAD-${"a".repeat(600)}`;
    const tail = `${"b".repeat(300)}-TAIL`;
    const long = `${head}${tail}`;
    const files = [makeFile({ name: "TOOLS.md", path: "/tmp/TOOLS.md", content: long })];
    const warnings: string[] = [];
    const maxChars = 200;
    const [result] = buildBootstrapContextFiles(files, {
      maxChars,
      warn: (message) => warnings.push(message),
    });
    expect(result?.content).toContain("[...truncated, read TOOLS.md for full content...]");
    expect(result?.content.length).toBeLessThan(long.length);
    expect(result?.content.length).toBeLessThanOrEqual(maxChars + 120);
    expect(warnings.some((line) => line.includes("TOOLS.md"))).toBe(true);
  });

  it("keeps content under the default per-file limit", () => {
    const long = "a".repeat(DEFAULT_BOOTSTRAP_MAX_CHARS - 10);
    const files = [makeFile({ content: long })];
    const [result] = buildBootstrapContextFiles(files);
    expect(result?.content).toBe(long);
    expect(result?.content).not.toContain("[...truncated, read AGENTS.md for full content...]");
  });

  it("enforces total bootstrap cap across files", () => {
    const files = [
      makeFile({ name: "AGENTS.md", content: "a".repeat(30_000) }),
      makeFile({ name: "SOUL.md", path: "/tmp/SOUL.md", content: "b".repeat(30_000) }),
      makeFile({ name: "USER.md", path: "/tmp/USER.md", content: "c".repeat(30_000) }),
    ];
    const result = buildBootstrapContextFiles(files);
    const totalChars = result.reduce((sum, entry) => sum + entry.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS);
    expect(result.length).toBeGreaterThan(1);
  });

  it("self-heals by preserving non-AGENTS files under tight total budget", () => {
    const files = [
      makeFile({
        name: "AGENTS.md",
        content: "# Giant Agents\n" + "context line\n".repeat(50_000),
      }),
      makeFile({
        name: "SOUL.md",
        path: "/tmp/SOUL.md",
        content: "# Voice\nAlways be concise and clear.",
      }),
      makeFile({
        name: "IDENTITY.md",
        path: "/tmp/IDENTITY.md",
        content: "# Identity\nNever reveal secrets.",
      }),
      makeFile({
        name: "USER.md",
        path: "/tmp/USER.md",
        content: "# User\nOnly use high-confidence facts.",
      }),
      makeFile({
        name: "TOOLS.md",
        path: "/tmp/TOOLS.md",
        content: "# Tools\nAlways explain side effects before destructive actions.",
      }),
    ];

    const warnings: string[] = [];
    const result = buildBootstrapContextFiles(files, {
      maxChars: 20_000,
      totalMaxChars: 24_000,
      warn: (message) => warnings.push(message),
    });

    const names = new Set(result.map((entry) => entry.path));
    expect(names.has("SOUL.md")).toBe(true);
    expect(names.has("IDENTITY.md")).toBe(true);
    expect(names.has("USER.md")).toBe(true);
    expect(names.has("TOOLS.md")).toBe(true);
    expect(warnings.some((line) => line.includes("self-healed via"))).toBe(true);
  });

  it("keeps missing markers under small budgets", () => {
    const files = [makeFile({ missing: true, content: undefined })];
    const result = buildBootstrapContextFiles(files, {
      totalMaxChars: 20,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.content.length).toBeLessThanOrEqual(20);
    expect(result[0]?.content.startsWith("[MISSING]")).toBe(true);
  });

  it("keeps directive lines after an unclosed fence during compaction", () => {
    const files = [
      makeFile({
        name: "AGENTS.md",
        content: [
          "# Rules",
          "```ts",
          "const noisy = true;".repeat(80),
          "Always keep this directive.",
          "Never drop this line.",
        ].join("\n"),
      }),
    ];

    const [result] = buildBootstrapContextFiles(files, {
      maxChars: 120,
      totalMaxChars: 120,
    });

    expect(result?.content).toContain("Always keep this directive.");
    expect(result?.content).toContain("Never drop this line.");
  });
});
