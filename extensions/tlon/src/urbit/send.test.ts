import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

mock("@urbit/aura", () => ({
  scot: mock(() => "mocked-ud"),
  da: {
    fromUnix: mock(() => 123n),
  },
}));

describe("sendDm", () => {
  afterEach(() => {
    // TODO: Review mock restoration;
  });

  it("uses aura v3 helpers for the DM id", async () => {
    const { sendDm } = await import("./send.js");
    const aura = await import("@urbit/aura");
    const scot = vi.mocked(aura.scot);
    const fromUnix = vi.mocked(aura.da.fromUnix);

    const sentAt = 1_700_000_000_000;
    spyOn(Date, "now").mockReturnValue(sentAt);

    const poke = mock(async () => ({}));

    const result = await sendDm({
      api: { poke },
      fromShip: "~zod",
      toShip: "~nec",
      text: "hi",
    });

    expect(fromUnix).toHaveBeenCalledWith(sentAt);
    expect(scot).toHaveBeenCalledWith("ud", 123n);
    expect(poke).toHaveBeenCalledTimes(1);
    expect(result.messageId).toBe("~zod/mocked-ud");
  });
});
