import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import fs from "node:fs";

describe("logger import side effects", () => {
  afterEach(() => {
    // TODO: Review mock restoration;
  });

  it("does not mkdir at import time", async () => {
    const mkdirSpy = spyOn(fs, "mkdirSync");

    await import("./logger.js");

    expect(mkdirSpy).not.toHaveBeenCalled();
  });
});
