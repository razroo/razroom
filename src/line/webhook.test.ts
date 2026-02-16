import crypto from "node:crypto";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { createLineWebhookMiddleware } from "./webhook.js";

const sign = (body: string, secret: string) =>
  crypto.createHmac("SHA256", secret).update(body).digest("base64");

const createRes = () => {
  const res = {
    status: mock(),
    json: mock(),
    headersSent: false,
    // oxlint-disable-next-line typescript/no-explicit-any
  } as any;
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe("createLineWebhookMiddleware", () => {
  it("parses JSON from raw string body", async () => {
    const onEvents = mock(async () => {});
    const secret = "secret";
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });
    const middleware = createLineWebhookMiddleware({ channelSecret: secret, onEvents });

    const req = {
      headers: { "x-line-signature": sign(rawBody, secret) },
      body: rawBody,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(onEvents).toHaveBeenCalledWith(expect.objectContaining({ events: expect.any(Array) }));
  });

  it("parses JSON from raw buffer body", async () => {
    const onEvents = mock(async () => {});
    const secret = "secret";
    const rawBody = JSON.stringify({ events: [{ type: "follow" }] });
    const middleware = createLineWebhookMiddleware({ channelSecret: secret, onEvents });

    const req = {
      headers: { "x-line-signature": sign(rawBody, secret) },
      body: Buffer.from(rawBody, "utf-8"),
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(onEvents).toHaveBeenCalledWith(expect.objectContaining({ events: expect.any(Array) }));
  });

  it("rejects invalid JSON payloads", async () => {
    const onEvents = mock(async () => {});
    const secret = "secret";
    const rawBody = "not json";
    const middleware = createLineWebhookMiddleware({ channelSecret: secret, onEvents });

    const req = {
      headers: { "x-line-signature": sign(rawBody, secret) },
      body: rawBody,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects webhooks with invalid signatures", async () => {
    const onEvents = mock(async () => {});
    const secret = "secret";
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });
    const middleware = createLineWebhookMiddleware({ channelSecret: secret, onEvents });

    const req = {
      headers: { "x-line-signature": "invalid-signature" },
      body: rawBody,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("returns 200 for verification request (empty events, no signature)", async () => {
    const onEvents = mock(async () => {});
    const secret = "secret";
    const rawBody = JSON.stringify({ events: [] });
    const middleware = createLineWebhookMiddleware({ channelSecret: secret, onEvents });

    const req = {
      headers: {},
      body: rawBody,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "ok" });
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects missing signature when events are non-empty", async () => {
    const onEvents = mock(async () => {});
    const secret = "secret";
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });
    const middleware = createLineWebhookMiddleware({ channelSecret: secret, onEvents });

    const req = {
      headers: {},
      body: rawBody,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing X-Line-Signature header" });
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects webhooks with signatures computed using wrong secret", async () => {
    const onEvents = mock(async () => {});
    const correctSecret = "correct-secret";
    const wrongSecret = "wrong-secret";
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });
    const middleware = createLineWebhookMiddleware({ channelSecret: correctSecret, onEvents });

    const req = {
      headers: { "x-line-signature": sign(rawBody, wrongSecret) },
      body: rawBody,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any;
    const res = createRes();

    // oxlint-disable-next-line typescript/no-explicit-any
    await middleware(req, res, {} as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(onEvents).not.toHaveBeenCalled();
  });
});
