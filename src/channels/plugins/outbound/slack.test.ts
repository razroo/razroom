import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock("../../../slack/send.js", () => ({
  sendMessageSlack: mock().mockResolvedValue({ messageId: "1234.5678", channelId: "C123" }),
}));

mock("../../../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: mock(),
}));

import { getGlobalHookRunner } from "../../../plugins/hook-runner-global.js";
import { sendMessageSlack } from "../../../slack/send.js";
import { slackOutbound } from "./slack.js";

describe("slack outbound hook wiring", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  afterEach(() => {
    // TODO: Review mock restoration;
  });

  it("calls send without hooks when no hooks registered", async () => {
    vi.mocked(getGlobalHookRunner).mockReturnValue(null);

    await slackOutbound.sendText({
      to: "C123",
      text: "hello",
      accountId: "default",
      replyToId: "1111.2222",
    });

    expect(sendMessageSlack).toHaveBeenCalledWith("C123", "hello", {
      threadTs: "1111.2222",
      accountId: "default",
    });
  });

  it("forwards identity opts when present", async () => {
    vi.mocked(getGlobalHookRunner).mockReturnValue(null);

    await slackOutbound.sendText({
      to: "C123",
      text: "hello",
      accountId: "default",
      replyToId: "1111.2222",
      identity: {
        name: "My Agent",
        avatarUrl: "https://example.com/avatar.png",
        emoji: ":should_not_send:",
      },
    });

    expect(sendMessageSlack).toHaveBeenCalledWith("C123", "hello", {
      threadTs: "1111.2222",
      accountId: "default",
      identity: { username: "My Agent", iconUrl: "https://example.com/avatar.png" },
    });
  });

  it("forwards icon_emoji only when icon_url is absent", async () => {
    vi.mocked(getGlobalHookRunner).mockReturnValue(null);

    await slackOutbound.sendText({
      to: "C123",
      text: "hello",
      accountId: "default",
      replyToId: "1111.2222",
      identity: { emoji: ":lobster:" },
    });

    expect(sendMessageSlack).toHaveBeenCalledWith("C123", "hello", {
      threadTs: "1111.2222",
      accountId: "default",
      identity: { iconEmoji: ":lobster:" },
    });
  });

  it("calls message_sending hook before sending", async () => {
    const mockRunner = {
      hasHooks: mock().mockReturnValue(true),
      runMessageSending: mock().mockResolvedValue(undefined),
    };
    // oxlint-disable-next-line typescript/no-explicit-any
    vi.mocked(getGlobalHookRunner).mockReturnValue(mockRunner as any);

    await slackOutbound.sendText({
      to: "C123",
      text: "hello",
      accountId: "default",
      replyToId: "1111.2222",
    });

    expect(mockRunner.hasHooks).toHaveBeenCalledWith("message_sending");
    expect(mockRunner.runMessageSending).toHaveBeenCalledWith(
      { to: "C123", content: "hello", metadata: { threadTs: "1111.2222", channelId: "C123" } },
      { channelId: "slack", accountId: "default" },
    );
    expect(sendMessageSlack).toHaveBeenCalledWith("C123", "hello", {
      threadTs: "1111.2222",
      accountId: "default",
    });
  });

  it("cancels send when hook returns cancel:true", async () => {
    const mockRunner = {
      hasHooks: mock().mockReturnValue(true),
      runMessageSending: mock().mockResolvedValue({ cancel: true }),
    };
    // oxlint-disable-next-line typescript/no-explicit-any
    vi.mocked(getGlobalHookRunner).mockReturnValue(mockRunner as any);

    const result = await slackOutbound.sendText({
      to: "C123",
      text: "hello",
      accountId: "default",
      replyToId: "1111.2222",
    });

    expect(sendMessageSlack).not.toHaveBeenCalled();
    expect(result.channel).toBe("slack");
  });

  it("modifies text when hook returns content", async () => {
    const mockRunner = {
      hasHooks: mock().mockReturnValue(true),
      runMessageSending: mock().mockResolvedValue({ content: "modified" }),
    };
    // oxlint-disable-next-line typescript/no-explicit-any
    vi.mocked(getGlobalHookRunner).mockReturnValue(mockRunner as any);

    await slackOutbound.sendText({
      to: "C123",
      text: "original",
      accountId: "default",
      replyToId: "1111.2222",
    });

    expect(sendMessageSlack).toHaveBeenCalledWith("C123", "modified", {
      threadTs: "1111.2222",
      accountId: "default",
    });
  });

  it("skips hooks when runner has no message_sending hooks", async () => {
    const mockRunner = {
      hasHooks: mock().mockReturnValue(false),
      runMessageSending: mock(),
    };
    // oxlint-disable-next-line typescript/no-explicit-any
    vi.mocked(getGlobalHookRunner).mockReturnValue(mockRunner as any);

    await slackOutbound.sendText({
      to: "C123",
      text: "hello",
      accountId: "default",
      replyToId: "1111.2222",
    });

    expect(mockRunner.runMessageSending).not.toHaveBeenCalled();
    expect(sendMessageSlack).toHaveBeenCalled();
  });
});
