import { describe, expect, it, mock, spyOn } from "bun:test";
import "./test-helpers/fast-coding-tools.js";
import { createMoltBotCodingTools } from "./pi-tools.js";

mock("./channel-tools.js", () => {
  const stubTool = (name: string) => ({
    name,
    description: `${name} stub`,
    parameters: { type: "object", properties: {} },
    execute: mock(),
  });
  return {
    listChannelAgentTools: () => [stubTool("whatsapp_login")],
  };
});

describe("whatsapp_login tool gating", () => {
  it("removes whatsapp_login for unauthorized senders", () => {
    const tools = createMoltBotCodingTools({ senderIsOwner: false });
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).not.toContain("whatsapp_login");
  });

  it("keeps whatsapp_login for authorized senders", () => {
    const tools = createMoltBotCodingTools({ senderIsOwner: true });
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).toContain("whatsapp_login");
  });

  it("defaults to removing whatsapp_login when owner status is unknown", () => {
    const tools = createMoltBotCodingTools();
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).not.toContain("whatsapp_login");
  });
});
