import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const mocks = vi.hoisted(() => ({
  getChannelPlugin: mock(),
  resolveOutboundTarget: mock(),
  deliverOutboundPayloads: mock(),
}));

mock("../../channels/plugins/index.js", () => ({
  normalizeChannelId: (channel?: string) => channel?.trim().toLowerCase() ?? undefined,
  getChannelPlugin: mocks.getChannelPlugin,
}));

mock("./targets.js", () => ({
  resolveOutboundTarget: mocks.resolveOutboundTarget,
}));

mock("./deliver.js", () => ({
  deliverOutboundPayloads: mocks.deliverOutboundPayloads,
}));

import { sendMessage } from "./message.js";

describe("sendMessage", () => {
  beforeEach(() => {
    mocks.getChannelPlugin.mockReset();
    mocks.resolveOutboundTarget.mockReset();
    mocks.deliverOutboundPayloads.mockReset();

    mocks.getChannelPlugin.mockReturnValue({
      outbound: { deliveryMode: "direct" },
    });
    mocks.resolveOutboundTarget.mockImplementation(({ to }: { to: string }) => ({ ok: true, to }));
    mocks.deliverOutboundPayloads.mockResolvedValue([{ channel: "mattermost", messageId: "m1" }]);
  });

  it("passes explicit agentId to outbound delivery for scoped media roots", async () => {
    await sendMessage({
      cfg: {},
      channel: "mattermost",
      to: "channel:town-square",
      content: "hi",
      agentId: "work",
    });

    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "work",
        channel: "mattermost",
        to: "channel:town-square",
      }),
    );
  });
});
