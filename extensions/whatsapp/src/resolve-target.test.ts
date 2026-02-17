import { describe, expect, it, mock, spyOn } from "bun:test";

mock("@razroo/razroom/plugin-sdk", () => ({
  getChatChannelMeta: () => ({ id: "whatsapp", label: "WhatsApp" }),
  normalizeWhatsAppTarget: (value: string) => {
    if (value === "invalid-target") return null;
    // Simulate E.164 normalization: strip leading + and whatsapp: prefix
    const stripped = value.replace(/^whatsapp:/i, "").replace(/^\+/, "");
    return stripped.includes("@g.us") ? stripped : `${stripped}@s.whatsapp.net`;
  },
  isWhatsAppGroupJid: (value: string) => value.endsWith("@g.us"),
  resolveWhatsAppOutboundTarget: ({
    to,
    allowFrom,
    mode,
  }: {
    to?: string;
    allowFrom: string[];
    mode: "explicit" | "implicit";
  }) => {
    const raw = typeof to === "string" ? to.trim() : "";
    if (!raw) {
      return { ok: false, error: new Error("missing target") };
    }
    const normalizeWhatsAppTarget = (value: string) => {
      if (value === "invalid-target") return null;
      const stripped = value.replace(/^whatsapp:/i, "").replace(/^\+/, "");
      return stripped.includes("@g.us") ? stripped : `${stripped}@s.whatsapp.net`;
    };
    const normalized = normalizeWhatsAppTarget(raw);
    if (!normalized) {
      return { ok: false, error: new Error("invalid target") };
    }

    if (mode === "implicit" && !normalized.endsWith("@g.us")) {
      const allowAll = allowFrom.includes("*");
      const allowExact = allowFrom.some((entry) => {
        if (!entry) {
          return false;
        }
        const normalizedEntry = normalizeWhatsAppTarget(entry.trim());
        return normalizedEntry?.toLowerCase() === normalized.toLowerCase();
      });
      if (!allowAll && !allowExact) {
        return { ok: false, error: new Error("target not allowlisted") };
      }
    }

    return { ok: true, to: normalized };
  },
  missingTargetError: (provider: string, hint: string) =>
    new Error(`Delivering to ${provider} requires target ${hint}`),
  WhatsAppConfigSchema: {},
  whatsappOnboardingAdapter: {},
  resolveWhatsAppHeartbeatRecipients: mock(),
  buildChannelConfigSchema: mock(),
  collectWhatsAppStatusIssues: mock(),
  createActionGate: mock(),
  DEFAULT_ACCOUNT_ID: "default",
  escapeRegExp: mock(),
  formatPairingApproveHint: mock(),
  listWhatsAppAccountIds: mock(),
  listWhatsAppDirectoryGroupsFromConfig: mock(),
  listWhatsAppDirectoryPeersFromConfig: mock(),
  looksLikeWhatsAppTargetId: mock(),
  migrateBaseNameToDefaultAccount: mock(),
  normalizeAccountId: mock(),
  normalizeE164: mock(),
  normalizeWhatsAppMessagingTarget: mock(),
  readStringParam: mock(),
  resolveDefaultWhatsAppAccountId: mock(),
  resolveWhatsAppAccount: mock(),
  resolveWhatsAppGroupRequireMention: mock(),
  resolveWhatsAppGroupToolPolicy: mock(),
  applyAccountNameToChannelSection: mock(),
}));

mock("./runtime.js", () => ({
  getWhatsAppRuntime: mock(() => ({
    channel: {
      text: { chunkText: mock() },
      whatsapp: {
        sendMessageWhatsApp: mock(),
        createLoginTool: mock(),
      },
    },
  })),
}));

import { whatsappPlugin } from "./channel.js";

const resolveTarget = whatsappPlugin.outbound!.resolveTarget!;

describe("whatsapp resolveTarget", () => {
  it("should resolve valid target in explicit mode", () => {
    const result = resolveTarget({
      to: "5511999999999",
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toBe("5511999999999@s.whatsapp.net");
  });

  it("should resolve target in implicit mode with wildcard", () => {
    const result = resolveTarget({
      to: "5511999999999",
      mode: "implicit",
      allowFrom: ["*"],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toBe("5511999999999@s.whatsapp.net");
  });

  it("should resolve target in implicit mode when in allowlist", () => {
    const result = resolveTarget({
      to: "5511999999999",
      mode: "implicit",
      allowFrom: ["5511999999999"],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toBe("5511999999999@s.whatsapp.net");
  });

  it("should allow group JID regardless of allowlist", () => {
    const result = resolveTarget({
      to: "120363123456789@g.us",
      mode: "implicit",
      allowFrom: ["5511999999999"],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toBe("120363123456789@g.us");
  });

  it("should error when target not in allowlist (implicit mode)", () => {
    const result = resolveTarget({
      to: "5511888888888",
      mode: "implicit",
      allowFrom: ["5511999999999", "5511777777777"],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should error on normalization failure with allowlist (implicit mode)", () => {
    const result = resolveTarget({
      to: "invalid-target",
      mode: "implicit",
      allowFrom: ["5511999999999"],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should error when no target provided with allowlist", () => {
    const result = resolveTarget({
      to: undefined,
      mode: "implicit",
      allowFrom: ["5511999999999"],
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
