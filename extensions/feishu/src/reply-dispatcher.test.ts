import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const resolveFeishuAccountMock = vi.hoisted(() => mock());
const getFeishuRuntimeMock = vi.hoisted(() => mock());
const sendMessageFeishuMock = vi.hoisted(() => mock());
const sendMarkdownCardFeishuMock = vi.hoisted(() => mock());
const createFeishuClientMock = vi.hoisted(() => mock());
const resolveReceiveIdTypeMock = vi.hoisted(() => mock());
const createReplyDispatcherWithTypingMock = vi.hoisted(() => mock());
const streamingInstances = vi.hoisted(() => [] as any[]);

mock("./accounts.js", () => ({ resolveFeishuAccount: resolveFeishuAccountMock }));
mock("./runtime.js", () => ({ getFeishuRuntime: getFeishuRuntimeMock }));
mock("./send.js", () => ({
  sendMessageFeishu: sendMessageFeishuMock,
  sendMarkdownCardFeishu: sendMarkdownCardFeishuMock,
}));
mock("./client.js", () => ({ createFeishuClient: createFeishuClientMock }));
mock("./targets.js", () => ({ resolveReceiveIdType: resolveReceiveIdTypeMock }));
mock("./streaming-card.js", () => ({
  FeishuStreamingSession: class {
    active = false;
    start = mock(async () => {
      this.active = true;
    });
    update = mock(async () => {});
    close = mock(async () => {
      this.active = false;
    });
    isActive = mock(() => this.active);

    constructor() {
      streamingInstances.push(this);
    }
  },
}));

import { createFeishuReplyDispatcher } from "./reply-dispatcher.js";

describe("createFeishuReplyDispatcher streaming behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamingInstances.length = 0;

    resolveFeishuAccountMock.mockReturnValue({
      accountId: "main",
      appId: "app_id",
      appSecret: "app_secret",
      domain: "feishu",
      config: {
        renderMode: "auto",
        streaming: true,
      },
    });

    resolveReceiveIdTypeMock.mockReturnValue("chat_id");
    createFeishuClientMock.mockReturnValue({});

    createReplyDispatcherWithTypingMock.mockImplementation((opts) => ({
      dispatcher: {},
      replyOptions: {},
      markDispatchIdle: mock(),
      _opts: opts,
    }));

    getFeishuRuntimeMock.mockReturnValue({
      channel: {
        text: {
          resolveTextChunkLimit: mock(() => 4000),
          resolveChunkMode: mock(() => "line"),
          resolveMarkdownTableMode: mock(() => "preserve"),
          convertMarkdownTables: mock((text) => text),
          chunkTextWithMode: mock((text) => [text]),
        },
        reply: {
          createReplyDispatcherWithTyping: createReplyDispatcherWithTypingMock,
          resolveHumanDelayConfig: mock(() => undefined),
        },
      },
    });
  });

  it("keeps auto mode plain text on non-streaming send path", async () => {
    createFeishuReplyDispatcher({
      cfg: {} as never,
      agentId: "agent",
      runtime: {} as never,
      chatId: "oc_chat",
    });

    const options = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];
    await options.deliver({ text: "plain text" }, { kind: "final" });

    expect(streamingInstances).toHaveLength(0);
    expect(sendMessageFeishuMock).toHaveBeenCalledTimes(1);
    expect(sendMarkdownCardFeishuMock).not.toHaveBeenCalled();
  });

  it("uses streaming session for auto mode markdown payloads", async () => {
    createFeishuReplyDispatcher({
      cfg: {} as never,
      agentId: "agent",
      runtime: { log: mock(), error: mock() } as never,
      chatId: "oc_chat",
    });

    const options = createReplyDispatcherWithTypingMock.mock.calls[0]?.[0];
    await options.deliver({ text: "```ts\nconst x = 1\n```" }, { kind: "final" });

    expect(streamingInstances).toHaveLength(1);
    expect(streamingInstances[0].start).toHaveBeenCalledTimes(1);
    expect(streamingInstances[0].close).toHaveBeenCalledTimes(1);
    expect(sendMessageFeishuMock).not.toHaveBeenCalled();
    expect(sendMarkdownCardFeishuMock).not.toHaveBeenCalled();
  });
});
