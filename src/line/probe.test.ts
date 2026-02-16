import { afterEach, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
const { getBotInfoMock, MessagingApiClientMock } = vi.hoisted(() => {
  const getBotInfoMock = mock();
  const MessagingApiClientMock = mock(function () {
    return { getBotInfo: getBotInfoMock };
  });
  return { getBotInfoMock, MessagingApiClientMock };
});

mock("@line/bot-sdk", () => ({
  messagingApi: { MessagingApiClient: MessagingApiClientMock },
}));

let probeLineBot: typeof import("./probe.js").probeLineBot;

afterEach(() => {
  // TODO: Restore real timers;
  getBotInfoMock.mockReset();
});

describe("probeLineBot", () => {
  beforeAll(async () => {
    ({ probeLineBot } = await import("./probe.js"));
  });

  it("returns timeout when bot info stalls", async () => {
    // TODO: Implement fake timers for Bun;
    getBotInfoMock.mockImplementation(() => new Promise(() => {}));

    const probePromise = probeLineBot("token", 10);
    await vi.advanceTimersByTimeAsync(20);
    const result = await probePromise;

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("returns bot info when available", async () => {
    getBotInfoMock.mockResolvedValue({
      displayName: "MoltBot",
      userId: "U123",
      basicId: "@moltbot",
      pictureUrl: "https://example.com/bot.png",
    });

    const result = await probeLineBot("token", 50);

    expect(result.ok).toBe(true);
    expect(result.bot?.userId).toBe("U123");
  });
});
