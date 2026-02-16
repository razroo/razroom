import type { RuntimeEnv, WizardPrompter } from "@razroo/razroom/plugin-sdk";
import { describe, expect, it, mock, spyOn } from "bun:test";
import type { CoreConfig } from "./types.js";
import { ircOnboardingAdapter } from "./onboarding.js";

describe("irc onboarding", () => {
  it("configures host and nick via onboarding prompts", async () => {
    const prompter: WizardPrompter = {
      intro: mock(async () => {}),
      outro: mock(async () => {}),
      note: mock(async () => {}),
      select: mock(async () => "allowlist"),
      multiselect: mock(async () => []),
      text: mock(async ({ message }: { message: string }) => {
        if (message === "IRC server host") {
          return "irc.libera.chat";
        }
        if (message === "IRC server port") {
          return "6697";
        }
        if (message === "IRC nick") {
          return "razroom-bot";
        }
        if (message === "IRC username") {
          return "razroom";
        }
        if (message === "IRC real name") {
          return "Razroom Bot";
        }
        if (message.startsWith("Auto-join IRC channels")) {
          return "#razroom, #ops";
        }
        if (message.startsWith("IRC channels allowlist")) {
          return "#razroom, #ops";
        }
        throw new Error(`Unexpected prompt: ${message}`);
      }) as WizardPrompter["text"],
      confirm: mock(async ({ message }: { message: string }) => {
        if (message === "Use TLS for IRC?") {
          return true;
        }
        if (message === "Configure IRC channels access?") {
          return true;
        }
        return false;
      }),
      progress: mock(() => ({ update: mock(), stop: mock() })),
    };

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock(),
    };

    const result = await ircOnboardingAdapter.configure({
      cfg: {} as CoreConfig,
      runtime,
      prompter,
      options: {},
      accountOverrides: {},
      shouldPromptAccountIds: false,
      forceAllowFrom: false,
    });

    expect(result.accountId).toBe("default");
    expect(result.cfg.channels?.irc?.enabled).toBe(true);
    expect(result.cfg.channels?.irc?.host).toBe("irc.libera.chat");
    expect(result.cfg.channels?.irc?.nick).toBe("razroom-bot");
    expect(result.cfg.channels?.irc?.tls).toBe(true);
    expect(result.cfg.channels?.irc?.channels).toEqual(["#razroom", "#ops"]);
    expect(result.cfg.channels?.irc?.groupPolicy).toBe("allowlist");
    expect(Object.keys(result.cfg.channels?.irc?.groups ?? {})).toEqual(["#razroom", "#ops"]);
  });

  it("writes DM allowFrom to top-level config for non-default account prompts", async () => {
    const prompter: WizardPrompter = {
      intro: mock(async () => {}),
      outro: mock(async () => {}),
      note: mock(async () => {}),
      select: mock(async () => "allowlist"),
      multiselect: mock(async () => []),
      text: mock(async ({ message }: { message: string }) => {
        if (message === "IRC allowFrom (nick or nick!user@host)") {
          return "Alice, Bob!ident@example.org";
        }
        throw new Error(`Unexpected prompt: ${message}`);
      }) as WizardPrompter["text"],
      confirm: mock(async () => false),
      progress: mock(() => ({ update: mock(), stop: mock() })),
    };

    const promptAllowFrom = ircOnboardingAdapter.dmPolicy?.promptAllowFrom;
    expect(promptAllowFrom).toBeTypeOf("function");

    const cfg: CoreConfig = {
      channels: {
        irc: {
          accounts: {
            work: {
              host: "irc.libera.chat",
              nick: "razroom-work",
            },
          },
        },
      },
    };

    const updated = (await promptAllowFrom?.({
      cfg,
      prompter,
      accountId: "work",
    })) as CoreConfig;

    expect(updated.channels?.irc?.allowFrom).toEqual(["alice", "bob!ident@example.org"]);
    expect(updated.channels?.irc?.accounts?.work?.allowFrom).toBeUndefined();
  });
});
