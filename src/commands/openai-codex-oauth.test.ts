import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

const mocks = vi.hoisted(() => ({
  loginOpenAICodex: mock(),
  createVpsAwareOAuthHandlers: mock(),
}));

mock("@mariozechner/pi-ai", () => ({
  loginOpenAICodex: mocks.loginOpenAICodex,
}));

mock("./oauth-flow.js", () => ({
  createVpsAwareOAuthHandlers: mocks.createVpsAwareOAuthHandlers,
}));

import { loginOpenAICodexOAuth } from "./openai-codex-oauth.js";

function createPrompter() {
  const spin = { update: mock(), stop: mock() };
  const prompter: Pick<WizardPrompter, "note" | "progress"> = {
    note: mock(async () => {}),
    progress: mock(() => spin),
  };
  return { prompter: prompter as unknown as WizardPrompter, spin };
}

function createRuntime(): RuntimeEnv {
  return {
    log: mock(),
    error: mock(),
    exit: mock((code: number) => {
      throw new Error(`exit:${code}`);
    }),
  };
}

describe("loginOpenAICodexOAuth", () => {
  beforeEach(() => {
    // mock.restore() // TODO: Review mock cleanup;
  });

  it("returns credentials on successful oauth login", async () => {
    const creds = {
      provider: "openai-codex" as const,
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
      email: "user@example.com",
    };
    mocks.createVpsAwareOAuthHandlers.mockReturnValue({
      onAuth: mock(),
      onPrompt: mock(),
    });
    mocks.loginOpenAICodex.mockResolvedValue(creds);

    const { prompter, spin } = createPrompter();
    const runtime = createRuntime();
    const result = await loginOpenAICodexOAuth({
      prompter,
      runtime,
      isRemote: false,
      openUrl: async () => {},
    });

    expect(result).toEqual(creds);
    expect(mocks.loginOpenAICodex).toHaveBeenCalledOnce();
    expect(spin.stop).toHaveBeenCalledWith("OpenAI OAuth complete");
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it("reports oauth errors and rethrows", async () => {
    mocks.createVpsAwareOAuthHandlers.mockReturnValue({
      onAuth: mock(),
      onPrompt: mock(),
    });
    mocks.loginOpenAICodex.mockRejectedValue(new Error("oauth failed"));

    const { prompter, spin } = createPrompter();
    const runtime = createRuntime();
    await expect(
      loginOpenAICodexOAuth({
        prompter,
        runtime,
        isRemote: true,
        openUrl: async () => {},
      }),
    ).rejects.toThrow("oauth failed");

    expect(spin.stop).toHaveBeenCalledWith("OpenAI OAuth failed");
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining("oauth failed"));
    expect(prompter.note).toHaveBeenCalledWith(
      "Trouble with OAuth? See https://docs.moltbot.ai/start/faq",
      "OAuth help",
    );
  });
});
