import { afterEach, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";

mock("playwright-core", () => ({
  chromium: {
    connectOverCDP: mock(),
  },
}));

type FakeSession = {
  send: ReturnType<typeof mock>;
  detach: ReturnType<typeof mock>;
};

function createPage(opts: { targetId: string; snapshotFull?: string; hasSnapshotForAI?: boolean }) {
  const session: FakeSession = {
    send: mock().mockResolvedValue({
      targetInfo: { targetId: opts.targetId },
    }),
    detach: mock().mockResolvedValue(undefined),
  };

  const context = {
    newCDPSession: mock().mockResolvedValue(session),
  };

  const click = mock().mockResolvedValue(undefined);
  const dblclick = mock().mockResolvedValue(undefined);
  const fill = mock().mockResolvedValue(undefined);
  const locator = mock().mockReturnValue({ click, dblclick, fill });

  const page = {
    context: () => context,
    locator,
    on: mock(),
    ...(opts.hasSnapshotForAI === false
      ? {}
      : {
          _snapshotForAI: mock().mockResolvedValue({ full: opts.snapshotFull ?? "SNAP" }),
        }),
  };

  return { page, session, locator, click, fill };
}

function createBrowser(pages: unknown[]) {
  const ctx = {
    pages: () => pages,
    on: mock(),
  };
  return {
    contexts: () => [ctx],
    on: mock(),
    close: mock().mockResolvedValue(undefined),
  };
}

let chromiumMock: typeof import("playwright-core").chromium;
let snapshotAiViaPlaywright: typeof import("./pw-tools-core.snapshot.js").snapshotAiViaPlaywright;
let clickViaPlaywright: typeof import("./pw-tools-core.interactions.js").clickViaPlaywright;
let closePlaywrightBrowserConnection: typeof import("./pw-session.js").closePlaywrightBrowserConnection;

beforeAll(async () => {
  const pw = await import("playwright-core");
  chromiumMock = pw.chromium;
  ({ snapshotAiViaPlaywright } = await import("./pw-tools-core.snapshot.js"));
  ({ clickViaPlaywright } = await import("./pw-tools-core.interactions.js"));
  ({ closePlaywrightBrowserConnection } = await import("./pw-session.js"));
});

afterEach(async () => {
  await closePlaywrightBrowserConnection();
  // mock.restore() // TODO: Review mock cleanup;
});

describe("pw-ai", () => {
  it("captures an ai snapshot via Playwright for a specific target", async () => {
    const p1 = createPage({ targetId: "T1", snapshotFull: "ONE" });
    const p2 = createPage({ targetId: "T2", snapshotFull: "TWO" });
    const browser = createBrowser([p1.page, p2.page]);

    (chromiumMock.connectOverCDP as unknown as ReturnType<typeof mock>).mockResolvedValue(browser);

    const res = await snapshotAiViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T2",
    });

    expect(res.snapshot).toBe("TWO");
    expect(p1.session.detach).toHaveBeenCalledTimes(1);
    expect(p2.session.detach).toHaveBeenCalledTimes(1);
  });

  it("registers aria refs from ai snapshots for act commands", async () => {
    const snapshot = ['- button "OK" [ref=e1]', '- link "Docs" [ref=e2]'].join("\n");
    const p1 = createPage({ targetId: "T1", snapshotFull: snapshot });
    const browser = createBrowser([p1.page]);

    (chromiumMock.connectOverCDP as unknown as ReturnType<typeof mock>).mockResolvedValue(browser);

    const res = await snapshotAiViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
    });

    expect(res.refs).toMatchObject({
      e1: { role: "button", name: "OK" },
      e2: { role: "link", name: "Docs" },
    });

    await clickViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
      ref: "e1",
    });

    expect(p1.locator).toHaveBeenCalledWith("aria-ref=e1");
    expect(p1.click).toHaveBeenCalledTimes(1);
  });

  it("truncates oversized snapshots", async () => {
    const longSnapshot = "A".repeat(20);
    const p1 = createPage({ targetId: "T1", snapshotFull: longSnapshot });
    const browser = createBrowser([p1.page]);

    (chromiumMock.connectOverCDP as unknown as ReturnType<typeof mock>).mockResolvedValue(browser);

    const res = await snapshotAiViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
      maxChars: 10,
    });

    expect(res.truncated).toBe(true);
    expect(res.snapshot.startsWith("AAAAAAAAAA")).toBe(true);
    expect(res.snapshot).toContain("TRUNCATED");
  });

  it("clicks a ref using aria-ref locator", async () => {
    const p1 = createPage({ targetId: "T1" });
    const browser = createBrowser([p1.page]);
    (chromiumMock.connectOverCDP as unknown as ReturnType<typeof mock>).mockResolvedValue(browser);

    await clickViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
      ref: "76",
    });

    expect(p1.locator).toHaveBeenCalledWith("aria-ref=76");
    expect(p1.click).toHaveBeenCalledTimes(1);
  });

  it("fails with a clear error when _snapshotForAI is missing", async () => {
    const p1 = createPage({ targetId: "T1", hasSnapshotForAI: false });
    const browser = createBrowser([p1.page]);
    (chromiumMock.connectOverCDP as unknown as ReturnType<typeof mock>).mockResolvedValue(browser);

    await expect(
      snapshotAiViaPlaywright({
        cdpUrl: "http://127.0.0.1:18792",
        targetId: "T1",
      }),
    ).rejects.toThrow(/_snapshotForAI/i);
  });

  it("reuses the CDP connection for repeated calls", async () => {
    const p1 = createPage({ targetId: "T1", snapshotFull: "ONE" });
    const browser = createBrowser([p1.page]);
    const connect = spyOn(chromiumMock, "connectOverCDP");
    connect.mockResolvedValue(browser);

    await snapshotAiViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
    });
    await clickViaPlaywright({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "T1",
      ref: "1",
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });
});
