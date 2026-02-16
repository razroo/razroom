import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const { botApi, botCtorSpy } = vi.hoisted(() => ({
  botApi: {
    sendMessage: mock(),
    setMessageReaction: mock(),
    deleteMessage: mock(),
  },
  botCtorSpy: mock(),
}));

const { loadConfig } = vi.hoisted(() => ({
  loadConfig: mock(() => ({})),
}));

const { makeProxyFetch } = vi.hoisted(() => ({
  makeProxyFetch: mock(),
}));

const { resolveTelegramFetch } = vi.hoisted(() => ({
  resolveTelegramFetch: mock(),
}));

mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig,
  };
});

mock("./proxy.js", () => ({
  makeProxyFetch,
}));

mock("./fetch.js", () => ({
  resolveTelegramFetch,
}));

mock("grammy", () => ({
  Bot: class {
    api = botApi;
    catch = mock();
    constructor(
      public token: string,
      public options?: { client?: { fetch?: typeof fetch; timeoutSeconds?: number } },
    ) {
      botCtorSpy(token, options);
    }
  },
  InputFile: class {},
}));

import { deleteMessageTelegram, reactMessageTelegram, sendMessageTelegram } from "./send.js";

describe("telegram proxy client", () => {
  const proxyUrl = "http://proxy.test:8080";

  beforeEach(() => {
    botApi.sendMessage.mockResolvedValue({ message_id: 1, chat: { id: "123" } });
    botApi.setMessageReaction.mockResolvedValue(undefined);
    botApi.deleteMessage.mockResolvedValue(true);
    botCtorSpy.mockReset();
    loadConfig.mockReturnValue({
      channels: { telegram: { accounts: { foo: { proxy: proxyUrl } } } },
    });
    makeProxyFetch.mockReset();
    resolveTelegramFetch.mockReset();
  });

  it("uses proxy fetch for sendMessage", async () => {
    const proxyFetch = mock();
    const fetchImpl = mock();
    makeProxyFetch.mockReturnValue(proxyFetch as unknown as typeof fetch);
    resolveTelegramFetch.mockReturnValue(fetchImpl as unknown as typeof fetch);

    await sendMessageTelegram("123", "hi", { token: "tok", accountId: "foo" });

    expect(makeProxyFetch).toHaveBeenCalledWith(proxyUrl);
    expect(resolveTelegramFetch).toHaveBeenCalledWith(proxyFetch, { network: undefined });
    expect(botCtorSpy).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({
        client: expect.objectContaining({ fetch: fetchImpl }),
      }),
    );
  });

  it("uses proxy fetch for reactions", async () => {
    const proxyFetch = mock();
    const fetchImpl = mock();
    makeProxyFetch.mockReturnValue(proxyFetch as unknown as typeof fetch);
    resolveTelegramFetch.mockReturnValue(fetchImpl as unknown as typeof fetch);

    await reactMessageTelegram("123", "456", "✅", { token: "tok", accountId: "foo" });

    expect(makeProxyFetch).toHaveBeenCalledWith(proxyUrl);
    expect(resolveTelegramFetch).toHaveBeenCalledWith(proxyFetch, { network: undefined });
    expect(botCtorSpy).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({
        client: expect.objectContaining({ fetch: fetchImpl }),
      }),
    );
  });

  it("uses proxy fetch for deleteMessage", async () => {
    const proxyFetch = mock();
    const fetchImpl = mock();
    makeProxyFetch.mockReturnValue(proxyFetch as unknown as typeof fetch);
    resolveTelegramFetch.mockReturnValue(fetchImpl as unknown as typeof fetch);

    await deleteMessageTelegram("123", "456", { token: "tok", accountId: "foo" });

    expect(makeProxyFetch).toHaveBeenCalledWith(proxyUrl);
    expect(resolveTelegramFetch).toHaveBeenCalledWith(proxyFetch, { network: undefined });
    expect(botCtorSpy).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({
        client: expect.objectContaining({ fetch: fetchImpl }),
      }),
    );
  });
});
