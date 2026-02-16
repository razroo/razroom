import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { monitorTelegramProvider } from "./monitor.js";

type MockCtx = {
  message: {
    chat: { id: number; type: string; title?: string };
    text?: string;
    caption?: string;
  };
  me?: { username: string };
  getFile: () => Promise<unknown>;
};

// Fake bot to capture handler and API calls
const handlers: Record<string, (ctx: MockCtx) => Promise<void> | void> = {};
const api = {
  sendMessage: mock(),
  sendPhoto: mock(),
  sendVideo: mock(),
  sendAudio: mock(),
  sendDocument: mock(),
  setWebhook: mock(),
  deleteWebhook: mock(),
};
const { initSpy, runSpy, loadConfig } = vi.hoisted(() => ({
  initSpy: mock(async () => undefined),
  runSpy: mock(() => ({
    task: () => Promise.resolve(),
    stop: mock(),
  })),
  loadConfig: mock(() => ({
    agents: { defaults: { maxConcurrent: 2 } },
    channels: { telegram: {} },
  })),
}));

const { computeBackoff, sleepWithAbort } = vi.hoisted(() => ({
  computeBackoff: mock(() => 0),
  sleepWithAbort: mock(async () => undefined),
}));
const { startTelegramWebhookSpy } = vi.hoisted(() => ({
  startTelegramWebhookSpy: mock(async () => ({ server: { close: mock() }, stop: mock() })),
}));

mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig,
  };
});

mock("./bot.js", () => ({
  createTelegramBot: () => {
    handlers.message = async (ctx: MockCtx) => {
      const chatId = ctx.message.chat.id;
      const isGroup = ctx.message.chat.type !== "private";
      const text = ctx.message.text ?? ctx.message.caption ?? "";
      if (isGroup && !text.includes("@mybot")) {
        return;
      }
      if (!text.trim()) {
        return;
      }
      await api.sendMessage(chatId, `echo:${text}`, { parse_mode: "HTML" });
    };
    return {
      on: mock(),
      api,
      me: { username: "mybot" },
      init: initSpy,
      stop: mock(),
      start: mock(),
    };
  },
  createTelegramWebhookCallback: mock(),
}));

// Mock the grammyjs/runner to resolve immediately
mock("@grammyjs/runner", () => ({
  run: runSpy,
}));

mock("../infra/backoff.js", () => ({
  computeBackoff,
  sleepWithAbort,
}));

mock("./webhook.js", () => ({
  startTelegramWebhook: (...args: unknown[]) => startTelegramWebhookSpy(...args),
}));

mock("../auto-reply/reply.js", () => ({
  getReplyFromConfig: async (ctx: { Body?: string }) => ({
    text: `echo:${ctx.Body}`,
  }),
}));

describe("monitorTelegramProvider (grammY)", () => {
  beforeEach(() => {
    loadConfig.mockReturnValue({
      agents: { defaults: { maxConcurrent: 2 } },
      channels: { telegram: {} },
    });
    initSpy.mockClear();
    runSpy.mockClear();
    computeBackoff.mockClear();
    sleepWithAbort.mockClear();
    startTelegramWebhookSpy.mockClear();
  });

  it("processes a DM and sends reply", async () => {
    Object.values(api).forEach((fn) => {
      fn?.mockReset?.();
    });
    await monitorTelegramProvider({ token: "tok" });
    expect(handlers.message).toBeDefined();
    await handlers.message?.({
      message: {
        message_id: 1,
        chat: { id: 123, type: "private" },
        text: "hi",
      },
      me: { username: "mybot" },
      getFile: mock(async () => ({})),
    });
    expect(api.sendMessage).toHaveBeenCalledWith(123, "echo:hi", {
      parse_mode: "HTML",
    });
  });

  it("uses agent maxConcurrent for runner concurrency", async () => {
    runSpy.mockClear();
    loadConfig.mockReturnValue({
      agents: { defaults: { maxConcurrent: 3 } },
      channels: { telegram: {} },
    });

    await monitorTelegramProvider({ token: "tok" });

    expect(runSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sink: { concurrency: 3 },
        runner: expect.objectContaining({
          silent: true,
          maxRetryTime: 5 * 60 * 1000,
          retryInterval: "exponential",
        }),
      }),
    );
  });

  it("requires mention in groups by default", async () => {
    Object.values(api).forEach((fn) => {
      fn?.mockReset?.();
    });
    await monitorTelegramProvider({ token: "tok" });
    await handlers.message?.({
      message: {
        message_id: 2,
        chat: { id: -99, type: "supergroup", title: "G" },
        text: "hello all",
      },
      me: { username: "mybot" },
      getFile: mock(async () => ({})),
    });
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("retries on recoverable network errors", async () => {
    const networkError = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
    runSpy
      .mockImplementationOnce(() => ({
        task: () => Promise.reject(networkError),
        stop: mock(),
      }))
      .mockImplementationOnce(() => ({
        task: () => Promise.resolve(),
        stop: mock(),
      }));

    await monitorTelegramProvider({ token: "tok" });

    expect(computeBackoff).toHaveBeenCalled();
    expect(sleepWithAbort).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(2);
  });

  it("surfaces non-recoverable errors", async () => {
    runSpy.mockImplementationOnce(() => ({
      task: () => Promise.reject(new Error("bad token")),
      stop: mock(),
    }));

    await expect(monitorTelegramProvider({ token: "tok" })).rejects.toThrow("bad token");
  });

  it("passes configured webhookHost to webhook listener", async () => {
    await monitorTelegramProvider({
      token: "tok",
      useWebhook: true,
      webhookUrl: "https://example.test/telegram",
      webhookSecret: "secret",
      config: {
        agents: { defaults: { maxConcurrent: 2 } },
        channels: {
          telegram: {
            webhookHost: "0.0.0.0",
          },
        },
      },
    });

    expect(startTelegramWebhookSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "0.0.0.0",
      }),
    );
    expect(runSpy).not.toHaveBeenCalled();
  });
});
