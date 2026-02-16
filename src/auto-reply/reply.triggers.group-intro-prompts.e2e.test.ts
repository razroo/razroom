import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";

mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: mock().mockReturnValue(false),
  compactEmbeddedPiSession: mock(),
  runEmbeddedPiAgent: mock(),
  queueEmbeddedPiMessage: mock().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: mock().mockReturnValue(false),
  isEmbeddedPiRunStreaming: mock().mockReturnValue(false),
}));

const usageMocks = vi.hoisted(() => ({
  loadProviderUsageSummary: mock().mockResolvedValue({
    updatedAt: 0,
    providers: [],
  }),
  formatUsageSummaryLine: mock().mockReturnValue("📊 Usage: Claude 80% left"),
  resolveUsageProviderId: mock((provider: string) => provider.split("/")[0]),
}));

mock("../infra/provider-usage.js", () => usageMocks);

const modelCatalogMocks = vi.hoisted(() => ({
  loadModelCatalog: mock().mockResolvedValue([
    {
      provider: "anthropic",
      id: "claude-opus-4-5",
      name: "Claude Opus 4.5",
      contextWindow: 200000,
    },
    {
      provider: "openrouter",
      id: "anthropic/claude-opus-4-5",
      name: "Claude Opus 4.5 (OpenRouter)",
      contextWindow: 200000,
    },
    { provider: "openai", id: "gpt-4.1-mini", name: "GPT-4.1 mini" },
    { provider: "openai", id: "gpt-5.2", name: "GPT-5.2" },
    { provider: "openai-codex", id: "gpt-5.2", name: "GPT-5.2 (Codex)" },
    { provider: "minimax", id: "MiniMax-M2.1", name: "MiniMax M2.1" },
  ]),
  resetModelCatalogCacheForTest: mock(),
}));

mock("../agents/model-catalog.js", () => modelCatalogMocks);

import { abortEmbeddedPiRun, runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { getReplyFromConfig } from "./reply.js";

const _MAIN_SESSION_KEY = "agent:main:main";

const webMocks = vi.hoisted(() => ({
  webAuthExists: mock().mockResolvedValue(true),
  getWebAuthAgeMs: mock().mockReturnValue(120_000),
  readWebSelfId: mock().mockReturnValue({ e164: "+1999" }),
}));

mock("../web/session.js", () => webMocks);

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(
    async (home) => {
      await mkdir(join(home, ".razroom", "agents", "main", "sessions"), { recursive: true });
      vi.mocked(runEmbeddedPiAgent).mockClear();
      vi.mocked(abortEmbeddedPiRun).mockClear();
      return await fn(home);
    },
    { prefix: "razroom-triggers-" },
  );
}

function makeCfg(home: string) {
  return {
    agents: {
      defaults: {
        model: "anthropic/claude-opus-4-5",
        workspace: join(home, "razroom"),
      },
    },
    channels: {
      whatsapp: {
        allowFrom: ["*"],
      },
    },
    session: { store: join(home, "sessions.json") },
  };
}

afterEach(() => {
  // TODO: Review mock restoration;
});

describe("group intro prompts", () => {
  const groupParticipationNote =
    "Be a good group participant: mostly lurk and follow the conversation; reply only when directly addressed or you can add clear value. Emoji reactions are welcome when available. Write like a human. Avoid Markdown tables. Don't type literal \\n sequences; use real line breaks sparingly.";

  it("labels Discord groups using the surface metadata", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      await getReplyFromConfig(
        {
          Body: "status update",
          From: "discord:group:dev",
          To: "+1888",
          ChatType: "group",
          GroupSubject: "Release Squad",
          GroupMembers: "Alice, Bob",
          Provider: "discord",
        },
        {},
        makeCfg(home),
      );

      expect(runEmbeddedPiAgent).toHaveBeenCalledOnce();
      const extraSystemPrompt =
        vi.mocked(runEmbeddedPiAgent).mock.calls.at(-1)?.[0]?.extraSystemPrompt ?? "";
      expect(extraSystemPrompt).toContain('"channel": "discord"');
      expect(extraSystemPrompt).toContain(
        `You are replying inside a Discord group chat. Activation: trigger-only (you are invoked only when explicitly mentioned; recent context may be included). ${groupParticipationNote} Address the specific sender noted in the message context.`,
      );
    });
  });
  it("keeps WhatsApp labeling for WhatsApp group chats", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      await getReplyFromConfig(
        {
          Body: "ping",
          From: "123@g.us",
          To: "+1999",
          ChatType: "group",
          GroupSubject: "Ops",
          Provider: "whatsapp",
        },
        {},
        makeCfg(home),
      );

      expect(runEmbeddedPiAgent).toHaveBeenCalledOnce();
      const extraSystemPrompt =
        vi.mocked(runEmbeddedPiAgent).mock.calls.at(-1)?.[0]?.extraSystemPrompt ?? "";
      expect(extraSystemPrompt).toContain('"channel": "whatsapp"');
      expect(extraSystemPrompt).toContain(
        `You are replying inside a WhatsApp group chat. Activation: trigger-only (you are invoked only when explicitly mentioned; recent context may be included). WhatsApp IDs: SenderId is the participant JID (group participant id). ${groupParticipationNote} Address the specific sender noted in the message context.`,
      );
    });
  });
  it("labels Telegram groups using their own surface", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      await getReplyFromConfig(
        {
          Body: "ping",
          From: "telegram:group:tg",
          To: "+1777",
          ChatType: "group",
          GroupSubject: "Dev Chat",
          Provider: "telegram",
        },
        {},
        makeCfg(home),
      );

      expect(runEmbeddedPiAgent).toHaveBeenCalledOnce();
      const extraSystemPrompt =
        vi.mocked(runEmbeddedPiAgent).mock.calls.at(-1)?.[0]?.extraSystemPrompt ?? "";
      expect(extraSystemPrompt).toContain('"channel": "telegram"');
      expect(extraSystemPrompt).toContain(
        `You are replying inside a Telegram group chat. Activation: trigger-only (you are invoked only when explicitly mentioned; recent context may be included). ${groupParticipationNote} Address the specific sender noted in the message context.`,
      );
    });
  });
});
