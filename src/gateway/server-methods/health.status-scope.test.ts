import { describe, expect, it, mock, spyOn } from "bun:test";
import { getStatusSummary } from "../../commands/status.js";
import { healthHandlers } from "./health.js";

mock("../../commands/status.js", () => ({
  getStatusSummary: mock().mockResolvedValue({ ok: true }),
}));

describe("gateway healthHandlers.status scope handling", () => {
  it("requests redacted status for non-admin clients", async () => {
    const respond = mock();
    await healthHandlers.status({
      respond,
      client: { connect: { role: "operator", scopes: ["operator.read"] } },
    } as Parameters<(typeof healthHandlers)["status"]>[0]);

    expect(vi.mocked(getStatusSummary)).toHaveBeenCalledWith({ includeSensitive: false });
    expect(respond).toHaveBeenCalledWith(true, { ok: true }, undefined);
  });

  it("requests full status for admin clients", async () => {
    const respond = mock();
    await healthHandlers.status({
      respond,
      client: { connect: { role: "operator", scopes: ["operator.admin"] } },
    } as Parameters<(typeof healthHandlers)["status"]>[0]);

    expect(vi.mocked(getStatusSummary)).toHaveBeenCalledWith({ includeSensitive: true });
    expect(respond).toHaveBeenCalledWith(true, { ok: true }, undefined);
  });
});
