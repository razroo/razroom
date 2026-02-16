import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { MediaAttachmentCache } from "./attachments.js";

const originalFetch = globalThis.fetch;

describe("media understanding attachments SSRF", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    // TODO: Review mock restoration;
  });

  it("blocks private IP URLs before fetching", async () => {
    const fetchSpy = mock();
    globalThis.fetch = fetchSpy as typeof fetch;

    const cache = new MediaAttachmentCache([{ index: 0, url: "http://127.0.0.1/secret.jpg" }]);

    await expect(
      cache.getBuffer({ attachmentIndex: 0, maxBytes: 1024, timeoutMs: 1000 }),
    ).rejects.toThrow(/private|internal|blocked/i);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
