import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { RazroomConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { discordPlugin } from "../../extensions/discord/src/channel.js";
import { imessagePlugin } from "../../extensions/imessage/src/channel.js";
import { signalPlugin } from "../../extensions/signal/src/channel.js";
import { slackPlugin } from "../../extensions/slack/src/channel.js";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { whatsappPlugin } from "../../extensions/whatsapp/src/channel.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { setupChannels } from "./onboard-channels.js";

mock("node:fs/promises", () => ({
  default: {
    access: mock(async () => {
      throw new Error("ENOENT");
    }),
  },
}));

mock("../channel-web.js", () => ({
  loginWeb: mock(async () => {}),
}));

mock("./onboard-helpers.js", () => ({
  detectBinary: mock(async () => false),
}));

describe("setupChannels", () => {
  beforeEach(() => {
    setActivePluginRegistry(
      createTestRegistry([
        { pluginId: "discord", plugin: discordPlugin, source: "test" },
        { pluginId: "slack", plugin: slackPlugin, source: "test" },
        { pluginId: "telegram", plugin: telegramPlugin, source: "test" },
        { pluginId: "whatsapp", plugin: whatsappPlugin, source: "test" },
        { pluginId: "signal", plugin: signalPlugin, source: "test" },
        { pluginId: "imessage", plugin: imessagePlugin, source: "test" },
      ]),
    );
  });
  it("QuickStart uses single-select (no multiselect) and doesn't prompt for Telegram token when WhatsApp is chosen", async () => {
    const select = mock(async () => "whatsapp");
    const multiselect = mock(async () => {
      throw new Error("unexpected multiselect");
    });
    const text = mock(async ({ message }: { message: string }) => {
      if (message.includes("Enter Telegram bot token")) {
        throw new Error("unexpected Telegram token prompt");
      }
      if (message.includes("Your personal WhatsApp number")) {
        return "+15555550123";
      }
      throw new Error(`unexpected text prompt: ${message}`);
    });

    const prompter: WizardPrompter = {
      intro: mock(async () => {}),
      outro: mock(async () => {}),
      note: mock(async () => {}),
      select,
      multiselect,
      text: text as unknown as WizardPrompter["text"],
      confirm: mock(async () => false),
      progress: mock(() => ({ update: mock(), stop: mock() })),
    };

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    await setupChannels({} as RazroomConfig, runtime, prompter, {
      skipConfirm: true,
      quickstartDefaults: true,
      forceAllowFromChannels: ["whatsapp"],
    });

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Select channel (QuickStart)" }),
    );
    expect(multiselect).not.toHaveBeenCalled();
  });

  it("shows explicit dmScope config command in channel primer", async () => {
    const note = mock(async () => {});
    const select = mock(async () => "__done__");
    const multiselect = mock(async () => {
      throw new Error("unexpected multiselect");
    });
    const text = mock(async ({ message }: { message: string }) => {
      throw new Error(`unexpected text prompt: ${message}`);
    });

    const prompter: WizardPrompter = {
      intro: mock(async () => {}),
      outro: mock(async () => {}),
      note,
      select,
      multiselect,
      text: text as unknown as WizardPrompter["text"],
      confirm: mock(async () => false),
      progress: mock(() => ({ update: mock(), stop: mock() })),
    };

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    await setupChannels({} as RazroomConfig, runtime, prompter, {
      skipConfirm: true,
    });

    const sawPrimer = note.mock.calls.some(
      ([message, title]) =>
        title === "How channels work" &&
        String(message).includes('config set session.dmScope "per-channel-peer"'),
    );
    expect(sawPrimer).toBe(true);
    expect(multiselect).not.toHaveBeenCalled();
  });

  it("prompts for configured channel action and skips configuration when told to skip", async () => {
    const select = mock(async ({ message }: { message: string }) => {
      if (message === "Select channel (QuickStart)") {
        return "telegram";
      }
      if (message.includes("already configured")) {
        return "skip";
      }
      throw new Error(`unexpected select prompt: ${message}`);
    });
    const multiselect = mock(async () => {
      throw new Error("unexpected multiselect");
    });
    const text = mock(async ({ message }: { message: string }) => {
      throw new Error(`unexpected text prompt: ${message}`);
    });

    const prompter: WizardPrompter = {
      intro: mock(async () => {}),
      outro: mock(async () => {}),
      note: mock(async () => {}),
      select,
      multiselect,
      text: text as unknown as WizardPrompter["text"],
      confirm: mock(async () => false),
      progress: mock(() => ({ update: mock(), stop: mock() })),
    };

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    await setupChannels(
      {
        channels: {
          telegram: {
            botToken: "token",
          },
        },
      } as RazroomConfig,
      runtime,
      prompter,
      {
        skipConfirm: true,
        quickstartDefaults: true,
      },
    );

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Select channel (QuickStart)" }),
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("already configured") }),
    );
    expect(multiselect).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("adds disabled hint to channel selection when a channel is disabled", async () => {
    let selectionCount = 0;
    const select = mock(async ({ message, options }: { message: string; options: unknown[] }) => {
      if (message === "Select a channel") {
        selectionCount += 1;
        const opts = options as Array<{ value: string; hint?: string }>;
        const telegram = opts.find((opt) => opt.value === "telegram");
        expect(telegram?.hint).toContain("disabled");
        return selectionCount === 1 ? "telegram" : "__done__";
      }
      if (message.includes("already configured")) {
        return "skip";
      }
      return "__done__";
    });
    const multiselect = mock(async () => {
      throw new Error("unexpected multiselect");
    });
    const prompter: WizardPrompter = {
      intro: mock(async () => {}),
      outro: mock(async () => {}),
      note: mock(async () => {}),
      select,
      multiselect,
      text: mock(async () => ""),
      confirm: mock(async () => false),
      progress: mock(() => ({ update: mock(), stop: mock() })),
    };

    const runtime: RuntimeEnv = {
      log: mock(),
      error: mock(),
      exit: mock((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    await setupChannels(
      {
        channels: {
          telegram: {
            botToken: "token",
            enabled: false,
          },
        },
      } as RazroomConfig,
      runtime,
      prompter,
      {
        skipConfirm: true,
      },
    );

    expect(select).toHaveBeenCalledWith(expect.objectContaining({ message: "Select a channel" }));
    expect(multiselect).not.toHaveBeenCalled();
  });
});
