import { describe, expect, it, mock, spyOn } from "bun:test";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import {
  handleToolExecutionEnd,
  handleToolExecutionStart,
} from "./pi-embedded-subscribe.handlers.tools.js";

// Minimal mock context factory. Only the fields needed for the media emission path.
function createMockContext(overrides?: {
  shouldEmitToolOutput?: boolean;
  onToolResult?: ReturnType<typeof mock>;
}): EmbeddedPiSubscribeContext {
  const onToolResult = overrides?.onToolResult ?? mock();
  return {
    params: {
      runId: "test-run",
      onToolResult,
      onAgentEvent: mock(),
    },
    state: {
      toolMetaById: new Map(),
      toolMetas: [],
      toolSummaryById: new Set(),
      pendingMessagingTexts: new Map(),
      pendingMessagingTargets: new Map(),
      messagingToolSentTexts: [],
      messagingToolSentTextsNormalized: [],
      messagingToolSentTargets: [],
    },
    log: { debug: mock(), warn: mock() },
    shouldEmitToolResult: mock(() => false),
    shouldEmitToolOutput: mock(() => overrides?.shouldEmitToolOutput ?? false),
    emitToolSummary: mock(),
    emitToolOutput: mock(),
    trimMessagingToolSent: mock(),
    hookRunner: undefined,
    // Fill in remaining required fields with no-ops.
    blockChunker: null,
    noteLastAssistant: mock(),
    stripBlockTags: mock((t: string) => t),
    emitBlockChunk: mock(),
    flushBlockReplyBuffer: mock(),
    emitReasoningStream: mock(),
    consumeReplyDirectives: mock(() => null),
    consumePartialReplyDirectives: mock(() => null),
    resetAssistantMessageState: mock(),
    resetForCompactionRetry: mock(),
    finalizeAssistantTexts: mock(),
    ensureCompactionPromise: mock(),
    noteCompactionRetry: mock(),
    resolveCompactionRetry: mock(),
    maybeResolveCompactionWait: mock(),
    recordAssistantUsage: mock(),
    incrementCompactionCount: mock(),
    getUsageTotals: mock(() => undefined),
    getCompactionCount: mock(() => 0),
  } as unknown as EmbeddedPiSubscribeContext;
}

describe("handleToolExecutionEnd media emission", () => {
  it("does not warn for read tool when path is provided via file_path alias", async () => {
    const ctx = createMockContext();

    await handleToolExecutionStart(ctx, {
      type: "tool_execution_start",
      toolName: "read",
      toolCallId: "tc-1",
      args: { file_path: "README.md" },
    });

    expect(ctx.log.warn).not.toHaveBeenCalled();
  });

  it("emits media when verbose is off and tool result has MEDIA: path", async () => {
    const onToolResult = mock();
    const ctx = createMockContext({ shouldEmitToolOutput: false, onToolResult });

    await handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "browser",
      toolCallId: "tc-1",
      isError: false,
      result: {
        content: [
          { type: "text", text: "MEDIA:/tmp/screenshot.png" },
          { type: "image", data: "base64", mimeType: "image/png" },
        ],
        details: { path: "/tmp/screenshot.png" },
      },
    });

    expect(onToolResult).toHaveBeenCalledWith({
      mediaUrls: ["/tmp/screenshot.png"],
    });
  });

  it("does NOT emit media when verbose is full (emitToolOutput handles it)", async () => {
    const onToolResult = mock();
    const ctx = createMockContext({ shouldEmitToolOutput: true, onToolResult });

    await handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "browser",
      toolCallId: "tc-1",
      isError: false,
      result: {
        content: [
          { type: "text", text: "MEDIA:/tmp/screenshot.png" },
          { type: "image", data: "base64", mimeType: "image/png" },
        ],
        details: { path: "/tmp/screenshot.png" },
      },
    });

    // onToolResult should NOT be called by the new media path (emitToolOutput handles it).
    // It may be called by emitToolOutput, but the new block should not fire.
    // Verify emitToolOutput was called instead.
    expect(ctx.emitToolOutput).toHaveBeenCalled();
    // The direct media emission should not have been called with just mediaUrls.
    const directMediaCalls = onToolResult.mock.calls.filter(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === "object" &&
        "mediaUrls" in (call[0] as Record<string, unknown>) &&
        !("text" in (call[0] as Record<string, unknown>)),
    );
    expect(directMediaCalls).toHaveLength(0);
  });

  it("does NOT emit media for error results", async () => {
    const onToolResult = mock();
    const ctx = createMockContext({ shouldEmitToolOutput: false, onToolResult });

    await handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "browser",
      toolCallId: "tc-1",
      isError: true,
      result: {
        content: [
          { type: "text", text: "MEDIA:/tmp/screenshot.png" },
          { type: "image", data: "base64", mimeType: "image/png" },
        ],
        details: { path: "/tmp/screenshot.png" },
      },
    });

    expect(onToolResult).not.toHaveBeenCalled();
  });

  it("does NOT emit when tool result has no media", async () => {
    const onToolResult = mock();
    const ctx = createMockContext({ shouldEmitToolOutput: false, onToolResult });

    await handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "bash",
      toolCallId: "tc-1",
      isError: false,
      result: {
        content: [{ type: "text", text: "Command executed successfully" }],
      },
    });

    expect(onToolResult).not.toHaveBeenCalled();
  });

  it("emits media from details.path fallback when no MEDIA: text", async () => {
    const onToolResult = mock();
    const ctx = createMockContext({ shouldEmitToolOutput: false, onToolResult });

    await handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "canvas",
      toolCallId: "tc-1",
      isError: false,
      result: {
        content: [
          { type: "text", text: "Rendered canvas" },
          { type: "image", data: "base64", mimeType: "image/png" },
        ],
        details: { path: "/tmp/canvas-output.png" },
      },
    });

    expect(onToolResult).toHaveBeenCalledWith({
      mediaUrls: ["/tmp/canvas-output.png"],
    });
  });
});
