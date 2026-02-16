import { describe, expect, it, mock, spyOn } from "bun:test";

mock("openclaw/plugin-sdk", () => ({
  getChatChannelMeta: () => ({ id: "googlechat", label: "Google Chat" }),
  missingTargetError: (provider: string, hint: string) =>
    new Error(`Delivering to ${provider} requires target ${hint}`),
  GoogleChatConfigSchema: {},
  DEFAULT_ACCOUNT_ID: "default",
  PAIRING_APPROVED_MESSAGE: "Approved",
  applyAccountNameToChannelSection: mock(),
  buildChannelConfigSchema: mock(),
  deleteAccountFromConfigSection: mock(),
  formatPairingApproveHint: mock(),
  migrateBaseNameToDefaultAccount: mock(),
  normalizeAccountId: mock(),
  resolveChannelMediaMaxBytes: mock(),
  resolveGoogleChatGroupRequireMention: mock(),
  setAccountEnabledInConfigSection: mock(),
}));

mock("./accounts.js", () => ({
  listGoogleChatAccountIds: mock(),
  resolveDefaultGoogleChatAccountId: mock(),
  resolveGoogleChatAccount: mock(),
}));

mock("./actions.js", () => ({
  googlechatMessageActions: [],
}));

mock("./api.js", () => ({
  sendGoogleChatMessage: mock(),
  uploadGoogleChatAttachment: mock(),
  probeGoogleChat: mock(),
}));

mock("./monitor.js", () => ({
  resolveGoogleChatWebhookPath: mock(),
  startGoogleChatMonitor: mock(),
}));

mock("./onboarding.js", () => ({
  googlechatOnboardingAdapter: {},
}));

mock("./runtime.js", () => ({
  getGoogleChatRuntime: mock(() => ({
    channel: {
      text: { chunkMarkdownText: mock() },
    },
  })),
}));

mock("./targets.js", () => ({
  normalizeGoogleChatTarget: (raw?: string | null) => {
    if (!raw?.trim()) return undefined;
    if (raw === "invalid-target") return undefined;
    const trimmed = raw.trim().replace(/^(googlechat|google-chat|gchat):/i, "");
    if (trimmed.startsWith("spaces/")) return trimmed;
    if (trimmed.includes("@")) return `users/${trimmed.toLowerCase()}`;
    return `users/${trimmed}`;
  },
  isGoogleChatUserTarget: (value: string) => value.startsWith("users/"),
  isGoogleChatSpaceTarget: (value: string) => value.startsWith("spaces/"),
  resolveGoogleChatOutboundSpace: mock(),
}));

import { googlechatPlugin } from "./channel.js";

const resolveTarget = googlechatPlugin.outbound!.resolveTarget!;

describe("googlechat resolveTarget", () => {
  it("should resolve valid target", () => {
    const result = resolveTarget({
      to: "spaces/AAA",
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toBe("spaces/AAA");
  });

  it("should resolve email target", () => {
    const result = resolveTarget({
      to: "user@example.com",
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toBe("users/user@example.com");
  });

  it("should error on normalization failure with allowlist (implicit mode)", () => {
    const result = resolveTarget({
      to: "invalid-target",
      mode: "implicit",
      allowFrom: ["spaces/BBB"],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should error when no target provided with allowlist", () => {
    const result = resolveTarget({
      to: undefined,
      mode: "implicit",
      allowFrom: ["spaces/BBB"],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should error when no target and no allowlist", () => {
    const result = resolveTarget({
      to: undefined,
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should handle whitespace-only target", () => {
    const result = resolveTarget({
      to: "   ",
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
