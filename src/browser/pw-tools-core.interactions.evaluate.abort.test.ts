import { describe, expect, it, mock, spyOn } from "bun:test";

let page: { evaluate: ReturnType<typeof mock> } | null = null;
let locator: { evaluate: ReturnType<typeof mock> } | null = null;

const forceDisconnectPlaywrightForTarget = mock(async () => {});
const getPageForTargetId = mock(async () => {
  if (!page) {
    throw new Error("test: page not set");
  }
  return page;
});
const ensurePageState = mock(() => {});
const restoreRoleRefsForTarget = mock(() => {});
const refLocator = mock(() => {
  if (!locator) {
    throw new Error("test: locator not set");
  }
  return locator;
});

mock("./pw-session.js", () => {
  return {
    ensurePageState,
    forceDisconnectPlaywrightForTarget,
    getPageForTargetId,
    refLocator,
    restoreRoleRefsForTarget,
  };
});

describe("evaluateViaPlaywright (abort)", () => {
  it("rejects when aborted after page.evaluate starts", async () => {
    // mock.restore() // TODO: Review mock cleanup;
    const ctrl = new AbortController();

    let evalCalled!: () => void;
    const evalCalledPromise = new Promise<void>((resolve) => {
      evalCalled = resolve;
    });

    page = {
      evaluate: mock(() => {
        evalCalled();
        return new Promise(() => {});
      }),
    };
    locator = { evaluate: mock() };

    const { evaluateViaPlaywright } = await import("./pw-tools-core.interactions.js");
    const p = evaluateViaPlaywright({
      cdpUrl: "http://127.0.0.1:9222",
      fn: "() => 1",
      signal: ctrl.signal,
    });

    await evalCalledPromise;
    ctrl.abort(new Error("aborted by test"));

    await expect(p).rejects.toThrow("aborted by test");
    expect(forceDisconnectPlaywrightForTarget).toHaveBeenCalled();
  });

  it("rejects when aborted after locator.evaluate starts", async () => {
    // mock.restore() // TODO: Review mock cleanup;
    const ctrl = new AbortController();

    let evalCalled!: () => void;
    const evalCalledPromise = new Promise<void>((resolve) => {
      evalCalled = resolve;
    });

    page = { evaluate: mock() };
    locator = {
      evaluate: mock(() => {
        evalCalled();
        return new Promise(() => {});
      }),
    };

    const { evaluateViaPlaywright } = await import("./pw-tools-core.interactions.js");
    const p = evaluateViaPlaywright({
      cdpUrl: "http://127.0.0.1:9222",
      fn: "(el) => el.textContent",
      ref: "e1",
      signal: ctrl.signal,
    });

    await evalCalledPromise;
    ctrl.abort(new Error("aborted by test"));

    await expect(p).rejects.toThrow("aborted by test");
    expect(forceDisconnectPlaywrightForTarget).toHaveBeenCalled();
  });
});
