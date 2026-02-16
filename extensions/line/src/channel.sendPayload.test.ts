import type { RazroomConfig, PluginRuntime } from "@razroo/razroom/plugin-sdk";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { linePlugin } from "./channel.js";
import { setLineRuntime } from "./runtime.js";

type LineRuntimeMocks = {
  pushMessageLine: ReturnType<typeof mock>;
  pushMessagesLine: ReturnType<typeof mock>;
  pushFlexMessage: ReturnType<typeof mock>;
  pushTemplateMessage: ReturnType<typeof mock>;
  pushLocationMessage: ReturnType<typeof mock>;
  pushTextMessageWithQuickReplies: ReturnType<typeof mock>;
  createQuickReplyItems: ReturnType<typeof mock>;
  buildTemplateMessageFromPayload: ReturnType<typeof mock>;
  sendMessageLine: ReturnType<typeof mock>;
  chunkMarkdownText: ReturnType<typeof mock>;
  resolveLineAccount: ReturnType<typeof mock>;
  resolveTextChunkLimit: ReturnType<typeof mock>;
};

function createRuntime(): { runtime: PluginRuntime; mocks: LineRuntimeMocks } {
  const pushMessageLine = mock(async () => ({ messageId: "m-text", chatId: "c1" }));
  const pushMessagesLine = mock(async () => ({ messageId: "m-batch", chatId: "c1" }));
  const pushFlexMessage = mock(async () => ({ messageId: "m-flex", chatId: "c1" }));
  const pushTemplateMessage = mock(async () => ({ messageId: "m-template", chatId: "c1" }));
  const pushLocationMessage = mock(async () => ({ messageId: "m-loc", chatId: "c1" }));
  const pushTextMessageWithQuickReplies = mock(async () => ({
    messageId: "m-quick",
    chatId: "c1",
  }));
  const createQuickReplyItems = mock((labels: string[]) => ({ items: labels }));
  const buildTemplateMessageFromPayload = mock(() => ({ type: "buttons" }));
  const sendMessageLine = mock(async () => ({ messageId: "m-media", chatId: "c1" }));
  const chunkMarkdownText = mock((text: string) => [text]);
  const resolveTextChunkLimit = mock(() => 123);
  const resolveLineAccount = mock(
    ({ cfg, accountId }: { cfg: RazroomConfig; accountId?: string }) => {
      const resolved = accountId ?? "default";
      const lineConfig = (cfg.channels?.line ?? {}) as {
        accounts?: Record<string, Record<string, unknown>>;
      };
      const accountConfig = resolved !== "default" ? (lineConfig.accounts?.[resolved] ?? {}) : {};
      return {
        accountId: resolved,
        config: { ...lineConfig, ...accountConfig },
      };
    },
  );

  const runtime = {
    channel: {
      line: {
        pushMessageLine,
        pushMessagesLine,
        pushFlexMessage,
        pushTemplateMessage,
        pushLocationMessage,
        pushTextMessageWithQuickReplies,
        createQuickReplyItems,
        buildTemplateMessageFromPayload,
        sendMessageLine,
        resolveLineAccount,
      },
      text: {
        chunkMarkdownText,
        resolveTextChunkLimit,
      },
    },
  } as unknown as PluginRuntime;

  return {
    runtime,
    mocks: {
      pushMessageLine,
      pushMessagesLine,
      pushFlexMessage,
      pushTemplateMessage,
      pushLocationMessage,
      pushTextMessageWithQuickReplies,
      createQuickReplyItems,
      buildTemplateMessageFromPayload,
      sendMessageLine,
      chunkMarkdownText,
      resolveLineAccount,
      resolveTextChunkLimit,
    },
  };
}

describe("linePlugin outbound.sendPayload", () => {
  it("sends flex message without dropping text", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as RazroomConfig;

    const payload = {
      text: "Now playing:",
      channelData: {
        line: {
          flexMessage: {
            altText: "Now playing",
            contents: { type: "bubble" },
          },
        },
      },
    };

    await linePlugin.outbound.sendPayload({
      to: "line:group:1",
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.pushFlexMessage).toHaveBeenCalledTimes(1);
    expect(mocks.pushMessageLine).toHaveBeenCalledWith("line:group:1", "Now playing:", {
      verbose: false,
      accountId: "default",
    });
  });

  it("sends template message without dropping text", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as RazroomConfig;

    const payload = {
      text: "Choose one:",
      channelData: {
        line: {
          templateMessage: {
            type: "confirm",
            text: "Continue?",
            confirmLabel: "Yes",
            confirmData: "yes",
            cancelLabel: "No",
            cancelData: "no",
          },
        },
      },
    };

    await linePlugin.outbound.sendPayload({
      to: "line:user:1",
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.buildTemplateMessageFromPayload).toHaveBeenCalledTimes(1);
    expect(mocks.pushTemplateMessage).toHaveBeenCalledTimes(1);
    expect(mocks.pushMessageLine).toHaveBeenCalledWith("line:user:1", "Choose one:", {
      verbose: false,
      accountId: "default",
    });
  });

  it("attaches quick replies when no text chunks are present", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as RazroomConfig;

    const payload = {
      channelData: {
        line: {
          quickReplies: ["One", "Two"],
          flexMessage: {
            altText: "Card",
            contents: { type: "bubble" },
          },
        },
      },
    };

    await linePlugin.outbound.sendPayload({
      to: "line:user:2",
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.pushFlexMessage).not.toHaveBeenCalled();
    expect(mocks.pushMessagesLine).toHaveBeenCalledWith(
      "line:user:2",
      [
        {
          type: "flex",
          altText: "Card",
          contents: { type: "bubble" },
          quickReply: { items: ["One", "Two"] },
        },
      ],
      { verbose: false, accountId: "default" },
    );
    expect(mocks.createQuickReplyItems).toHaveBeenCalledWith(["One", "Two"]);
  });

  it("sends media before quick-reply text so buttons stay visible", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as RazroomConfig;

    const payload = {
      text: "Hello",
      mediaUrl: "https://example.com/img.jpg",
      channelData: {
        line: {
          quickReplies: ["One", "Two"],
        },
      },
    };

    await linePlugin.outbound.sendPayload({
      to: "line:user:3",
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.sendMessageLine).toHaveBeenCalledWith("line:user:3", "", {
      verbose: false,
      mediaUrl: "https://example.com/img.jpg",
      accountId: "default",
    });
    expect(mocks.pushTextMessageWithQuickReplies).toHaveBeenCalledWith(
      "line:user:3",
      "Hello",
      ["One", "Two"],
      { verbose: false, accountId: "default" },
    );
    const mediaOrder = mocks.sendMessageLine.mock.invocationCallOrder[0];
    const quickReplyOrder = mocks.pushTextMessageWithQuickReplies.mock.invocationCallOrder[0];
    expect(mediaOrder).toBeLessThan(quickReplyOrder);
  });

  it("uses configured text chunk limit for payloads", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: { textChunkLimit: 123 } } } as RazroomConfig;

    const payload = {
      text: "Hello world",
      channelData: {
        line: {
          flexMessage: {
            altText: "Card",
            contents: { type: "bubble" },
          },
        },
      },
    };

    await linePlugin.outbound.sendPayload({
      to: "line:user:3",
      payload,
      accountId: "primary",
      cfg,
    });

    expect(mocks.resolveTextChunkLimit).toHaveBeenCalledWith(cfg, "line", "primary", {
      fallbackLimit: 5000,
    });
    expect(mocks.chunkMarkdownText).toHaveBeenCalledWith("Hello world", 123);
  });
});

describe("linePlugin config.formatAllowFrom", () => {
  it("strips line:user: prefixes without lowercasing", () => {
    const formatted = linePlugin.config.formatAllowFrom({
      allowFrom: ["line:user:UABC", "line:UDEF"],
    });
    expect(formatted).toEqual(["UABC", "UDEF"]);
  });
});

describe("linePlugin groups.resolveRequireMention", () => {
  it("uses account-level group settings when provided", () => {
    const { runtime } = createRuntime();
    setLineRuntime(runtime);

    const cfg = {
      channels: {
        line: {
          groups: {
            "*": { requireMention: false },
          },
          accounts: {
            primary: {
              groups: {
                "group-1": { requireMention: true },
              },
            },
          },
        },
      },
    } as RazroomConfig;

    const requireMention = linePlugin.groups.resolveRequireMention({
      cfg,
      accountId: "primary",
      groupId: "group-1",
    });

    expect(requireMention).toBe(true);
  });
});
