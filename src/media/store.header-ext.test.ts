import { afterAll, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

const realOs = await vi.importActual<typeof import("node:os")>("node:os");
const HOME = path.join(realOs.tmpdir(), "razroom-home-header-ext-test");

mock("node:os", () => ({
  default: { homedir: () => HOME, tmpdir: () => realOs.tmpdir() },
  homedir: () => HOME,
  tmpdir: () => realOs.tmpdir(),
}));

mock("./mime.js", async () => {
  const actual = await vi.importActual<typeof import("./mime.js")>("./mime.js");
  return {
    ...actual,
    detectMime: mock(async () => "audio/opus"),
  };
});

const store = await import("./store.js");

describe("media store header extensions", () => {
  beforeAll(async () => {
    await fs.rm(HOME, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(HOME, { recursive: true, force: true });
  });

  it("prefers header mime extension when sniffed mime lacks mapping", async () => {
    const buf = Buffer.from("fake-audio");
    const saved = await store.saveMediaBuffer(buf, "audio/ogg; codecs=opus");
    expect(path.extname(saved.path)).toBe(".ogg");
  });
});
