import { DisconnectReason } from "@whiskeysockets/baileys";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const rmMock = spyOn(fs, "rm");

const authDir = path.join(os.tmpdir(), "wa-creds");

mock("../config/config.js", () => ({
  loadConfig: () =>
    ({
      channels: {
        whatsapp: {
          accounts: {
            default: { enabled: true, authDir },
          },
        },
      },
    }) as never,
}));

mock("./session.js", () => {
  const sockA = { ws: { close: mock() } };
  const sockB = { ws: { close: mock() } };
  let call = 0;
  const createWaSocket = mock(async () => (call++ === 0 ? sockA : sockB));
  const waitForWaConnection = mock();
  const formatError = mock((err: unknown) => `formatted:${String(err)}`);
  return {
    createWaSocket,
    waitForWaConnection,
    formatError,
    WA_WEB_AUTH_DIR: authDir,
    logoutWeb: mock(async (params: { authDir?: string }) => {
      await fs.rm(params.authDir ?? authDir, {
        recursive: true,
        force: true,
      });
      return true;
    }),
  };
});

const { createWaSocket, waitForWaConnection, formatError } = await import("./session.js");
const { loginWeb } = await import("./login.js");

describe("loginWeb coverage", () => {
  beforeEach(() => {
    // TODO: Implement fake timers for Bun;
    // mock.restore() // TODO: Review mock cleanup;
    rmMock.mockClear();
  });
  afterEach(() => {
    // TODO: Restore real timers;
  });

  it("restarts once when WhatsApp requests code 515", async () => {
    waitForWaConnection
      .mockRejectedValueOnce({ output: { statusCode: 515 } })
      .mockResolvedValueOnce(undefined);

    const runtime = { log: mock(), error: mock() } as never;
    await loginWeb(false, waitForWaConnection as never, runtime);

    expect(createWaSocket).toHaveBeenCalledTimes(2);
    const firstSock = await createWaSocket.mock.results[0].value;
    expect(firstSock.ws.close).toHaveBeenCalled();
    // TODO: Run all timers;
    const secondSock = await createWaSocket.mock.results[1].value;
    expect(secondSock.ws.close).toHaveBeenCalled();
  });

  it("clears creds and throws when logged out", async () => {
    waitForWaConnection.mockRejectedValueOnce({
      output: { statusCode: DisconnectReason.loggedOut },
    });

    await expect(loginWeb(false, waitForWaConnection as never)).rejects.toThrow(/cache cleared/i);
    expect(rmMock).toHaveBeenCalledWith(authDir, {
      recursive: true,
      force: true,
    });
  });

  it("formats and rethrows generic errors", async () => {
    waitForWaConnection.mockRejectedValueOnce(new Error("boom"));
    await expect(loginWeb(false, waitForWaConnection as never)).rejects.toThrow(
      "formatted:Error: boom",
    );
    expect(formatError).toHaveBeenCalled();
  });
});
