import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { EventEmitter } from "node:events";
import { resetLogger, setLoggerOverride } from "../logging.js";

mock("./session.js", () => {
  const ev = new EventEmitter();
  const sock = {
    ev,
    ws: { close: mock() },
    sendPresenceUpdate: mock(),
    sendMessage: mock(),
  };
  return {
    createWaSocket: mock().mockResolvedValue(sock),
    waitForWaConnection: mock().mockResolvedValue(undefined),
  };
});

import type { waitForWaConnection } from "./session.js";
import { loginWeb } from "./login.js";

const { createWaSocket } = await import("./session.js");

describe("web login", () => {
  beforeEach(() => {
    // TODO: Implement fake timers for Bun;
    // mock.restore() // TODO: Review mock cleanup;
  });

  afterEach(() => {
    // TODO: Restore real timers;
    resetLogger();
    setLoggerOverride(null);
  });

  it("loginWeb waits for connection and closes", async () => {
    const sock = await createWaSocket();
    const close = spyOn(sock.ws, "close");
    const waiter: typeof waitForWaConnection = mock().mockResolvedValue(undefined);
    await loginWeb(false, waiter);
    expect(close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    expect(close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
