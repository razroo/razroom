import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { resetInboundDedupe } from "../auto-reply/reply/inbound-dedupe.js";

const { monitorSlackProvider } = await import("./monitor.js");

const sendMock = mock();
const replyMock = mock();
const updateLastRouteMock = mock();
const reactMock = mock();
let config: Record<string, unknown> = {};
const readAllowFromStoreMock = mock();
const upsertPairingRequestMock = mock();
const getSlackHandlers = () =>
  (
    globalThis as {
      __slackHandlers?: Map<string, (args: unknown) => Promise<void>>;
    }
  ).__slackHandlers;
const getSlackClient = () =>
  (globalThis as { __slackClient?: Record<string, unknown> }).__slackClient;

mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => config,
  };
});

mock("../auto-reply/reply.js", () => ({
  getReplyFromConfig: (...args: unknown[]) => replyMock(...args),
}));

mock("./resolve-channels.js", () => ({
  resolveSlackChannelAllowlist: async ({ entries }: { entries: string[] }) =>
    entries.map((input) => ({ input, resolved: false })),
}));

mock("./resolve-users.js", () => ({
  resolveSlackUserAllowlist: async ({ entries }: { entries: string[] }) =>
    entries.map((input) => ({ input, resolved: false })),
}));

mock("./send.js", () => ({
  sendMessageSlack: (...args: unknown[]) => sendMock(...args),
}));

mock("../pairing/pairing-store.js", () => ({
  readChannelAllowFromStore: (...args: unknown[]) => readAllowFromStoreMock(...args),
  upsertChannelPairingRequest: (...args: unknown[]) => upsertPairingRequestMock(...args),
}));

mock("../config/sessions.js", () => ({
  resolveStorePath: mock(() => "/tmp/razroom-sessions.json"),
  updateLastRoute: (...args: unknown[]) => updateLastRouteMock(...args),
  resolveSessionKey: mock(),
  readSessionUpdatedAt: mock(() => undefined),
  recordSessionMetaFromInbound: mock().mockResolvedValue(undefined),
}));

mock("@slack/bolt", () => {
  const handlers = new Map<string, (args: unknown) => Promise<void>>();
  (globalThis as { __slackHandlers?: typeof handlers }).__slackHandlers = handlers;
  const client = {
    auth: { test: mock().mockResolvedValue({ user_id: "bot-user" }) },
    conversations: {
      info: mock().mockResolvedValue({
        channel: { name: "general", is_channel: true },
      }),
      replies: mock().mockResolvedValue({ messages: [] }),
      history: mock().mockResolvedValue({ messages: [] }),
    },
    users: {
      info: mock().mockResolvedValue({
        user: { profile: { display_name: "Ada" } },
      }),
    },
    assistant: {
      threads: {
        setStatus: mock().mockResolvedValue({ ok: true }),
      },
    },
    reactions: {
      add: (...args: unknown[]) => reactMock(...args),
    },
  };
  (globalThis as { __slackClient?: typeof client }).__slackClient = client;
  class App {
    client = client;
    event(name: string, handler: (args: unknown) => Promise<void>) {
      handlers.set(name, handler);
    }
    command() {
      /* no-op */
    }
    start = mock().mockResolvedValue(undefined);
    stop = mock().mockResolvedValue(undefined);
  }
  class HTTPReceiver {
    requestListener = mock();
  }
  return { App, HTTPReceiver, default: { App, HTTPReceiver } };
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function waitForEvent(name: string) {
  for (let i = 0; i < 10; i += 1) {
    if (getSlackHandlers()?.has(name)) {
      return;
    }
    await flush();
  }
}

beforeEach(() => {
  resetInboundDedupe();
  getSlackHandlers()?.clear();
  config = {
    messages: { responsePrefix: "PFX" },
    channels: {
      slack: {
        dm: { enabled: true, policy: "open", allowFrom: ["*"] },
        groupPolicy: "open",
        channels: { C1: { allow: true, requireMention: false } },
      },
    },
  };
  sendMock.mockReset().mockResolvedValue(undefined);
  replyMock.mockReset();
  updateLastRouteMock.mockReset();
  reactMock.mockReset();
  readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  upsertPairingRequestMock.mockReset().mockResolvedValue({ code: "PAIRCODE", created: true });
});

describe("monitorSlackProvider threading", () => {
  it("recovers missing thread_ts when parent_user_id is present", async () => {
    replyMock.mockResolvedValue({ text: "thread reply" });

    const client = getSlackClient();
    if (!client) {
      throw new Error("Slack client not registered");
    }
    const conversations = client.conversations as {
      history: ReturnType<typeof mock>;
    };
    conversations.history.mockResolvedValueOnce({
      messages: [{ ts: "456", thread_ts: "111.222" }],
    });

    const controller = new AbortController();
    const run = monitorSlackProvider({
      botToken: "bot-token",
      appToken: "app-token",
      abortSignal: controller.signal,
    });

    await waitForEvent("message");
    const handler = getSlackHandlers()?.get("message");
    if (!handler) {
      throw new Error("Slack message handler not registered");
    }

    await handler({
      event: {
        type: "message",
        user: "U1",
        text: "hello",
        ts: "456",
        parent_user_id: "U2",
        channel: "C1",
        channel_type: "channel",
      },
    });

    await flush();
    controller.abort();
    await run;

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][2]).toMatchObject({ threadTs: "111.222" });
  });
});
