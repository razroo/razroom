import type { AgentMessage } from "@mariozechner/pi-agent-core";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import type { WorkspaceBootstrapFile } from "../workspace.js";
import type { EmbeddedContextFile } from "./types.js";
import { truncateUtf16Safe } from "../../utils.js";

type ContentBlockWithSignature = {
  thought_signature?: unknown;
  thoughtSignature?: unknown;
  [key: string]: unknown;
};

type ThoughtSignatureSanitizeOptions = {
  allowBase64Only?: boolean;
  includeCamelCase?: boolean;
};

function isBase64Signature(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const compact = trimmed.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) {
    return false;
  }
  const isUrl = compact.includes("-") || compact.includes("_");
  try {
    const buf = Buffer.from(compact, isUrl ? "base64url" : "base64");
    if (buf.length === 0) {
      return false;
    }
    const encoded = buf.toString(isUrl ? "base64url" : "base64");
    const normalize = (input: string) => input.replace(/=+$/g, "");
    return normalize(encoded) === normalize(compact);
  } catch {
    return false;
  }
}

/**
 * Strips Claude-style thought_signature fields from content blocks.
 *
 * Gemini expects thought signatures as base64-encoded bytes, but Claude stores message ids
 * like "msg_abc123...". We only strip "msg_*" to preserve any provider-valid signatures.
 */
export function stripThoughtSignatures<T>(
  content: T,
  options?: ThoughtSignatureSanitizeOptions,
): T {
  if (!Array.isArray(content)) {
    return content;
  }
  const allowBase64Only = options?.allowBase64Only ?? false;
  const includeCamelCase = options?.includeCamelCase ?? false;
  const shouldStripSignature = (value: unknown): boolean => {
    if (!allowBase64Only) {
      return typeof value === "string" && value.startsWith("msg_");
    }
    return typeof value !== "string" || !isBase64Signature(value);
  };
  return content.map((block) => {
    if (!block || typeof block !== "object") {
      return block;
    }
    const rec = block as ContentBlockWithSignature;
    const stripSnake = shouldStripSignature(rec.thought_signature);
    const stripCamel = includeCamelCase ? shouldStripSignature(rec.thoughtSignature) : false;
    if (!stripSnake && !stripCamel) {
      return block;
    }
    const next = { ...rec };
    if (stripSnake) {
      delete next.thought_signature;
    }
    if (stripCamel) {
      delete next.thoughtSignature;
    }
    return next;
  }) as T;
}

export const DEFAULT_BOOTSTRAP_MAX_CHARS = 20_000;
export const DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS = 24_000;
const MIN_BOOTSTRAP_FILE_BUDGET_CHARS = 64;
const BOOTSTRAP_HEAD_RATIO = 0.7;
const BOOTSTRAP_TAIL_RATIO = 0.2;
const DIRECTIVE_LINE_RE =
  /\b(must|never|always|required|do not|don't|only|important|critical|rule|policy)\b/i;

type TrimBootstrapResult = {
  content: string;
  truncated: boolean;
  maxChars: number;
  originalLength: number;
};

type AllocatedBootstrapFile = {
  index: number;
  file: WorkspaceBootstrapFile;
  budget: number;
};

export function resolveBootstrapMaxChars(cfg?: OpenClawConfig): number {
  const raw = cfg?.agents?.defaults?.bootstrapMaxChars;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_BOOTSTRAP_MAX_CHARS;
}

export function resolveBootstrapTotalMaxChars(cfg?: OpenClawConfig): number {
  const raw = cfg?.agents?.defaults?.bootstrapTotalMaxChars;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS;
}

function trimBootstrapContent(
  content: string,
  fileName: string,
  maxChars: number,
): TrimBootstrapResult {
  const trimmed = content.trimEnd();
  if (trimmed.length <= maxChars) {
    return {
      content: trimmed,
      truncated: false,
      maxChars,
      originalLength: trimmed.length,
    };
  }

  const headChars = Math.floor(maxChars * BOOTSTRAP_HEAD_RATIO);
  const tailChars = Math.floor(maxChars * BOOTSTRAP_TAIL_RATIO);
  const head = trimmed.slice(0, headChars);
  const tail = trimmed.slice(-tailChars);

  const marker = [
    "",
    `[...truncated, read ${fileName} for full content...]`,
    `…(truncated ${fileName}: kept ${headChars}+${tailChars} chars of ${trimmed.length})…`,
    "",
  ].join("\n");
  const contentWithMarker = [head, marker, tail].join("\n");
  return {
    content: contentWithMarker,
    truncated: true,
    maxChars,
    originalLength: trimmed.length,
  };
}

function clampToBudget(content: string, budget: number): string {
  if (budget <= 0) {
    return "";
  }
  if (content.length <= budget) {
    return content;
  }
  if (budget <= 3) {
    return truncateUtf16Safe(content, budget);
  }
  return `${truncateUtf16Safe(content, budget - 1)}…`;
}

function normalizeCompactLines(lines: string[]): string {
  const out: string[] = [];
  let prevBlank = true;
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed.trim()) {
      if (!prevBlank) {
        out.push("");
      }
      prevBlank = true;
      continue;
    }
    out.push(trimmed);
    prevBlank = false;
  }
  return out.join("\n").trim();
}

function compactMarkdownForBootstrap(content: string, mode: "priority" | "ultra"): string {
  const input = content.trim();
  if (!input) {
    return "";
  }

  const lines = input.split(/\r?\n/);
  const hasUnclosedFence =
    lines.reduce((count, rawLine) => {
      const bare = rawLine.trim();
      return bare.startsWith("```") || bare.startsWith("~~~") ? count + 1 : count;
    }, 0) %
      2 !==
    0;
  const kept: string[] = [];
  let inFence = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bare = line.trim();

    if (!hasUnclosedFence && (bare.startsWith("```") || bare.startsWith("~~~"))) {
      inFence = !inFence;
      continue;
    }
    if (!hasUnclosedFence && inFence) {
      continue;
    }

    const isHeading = /^#{1,6}\s/.test(bare);
    const isBullet = /^([-*+]|\d+\.)\s/.test(bare);
    const isDirective = DIRECTIVE_LINE_RE.test(bare);
    const isShortSentence = bare.length > 0 && bare.length <= 120 && /[.!?]$/.test(bare);

    const keep =
      mode === "ultra"
        ? isHeading || isDirective
        : isHeading || isBullet || isDirective || isShortSentence;
    if (keep) {
      kept.push(line);
    }
  }

  const compacted = normalizeCompactLines(kept);
  if (compacted) {
    return compacted;
  }
  return input;
}

function resolveBootstrapPriority(fileName: string): number {
  switch (fileName.toUpperCase()) {
    case "SOUL.MD":
      return 100;
    case "IDENTITY.MD":
      return 95;
    case "USER.MD":
      return 90;
    case "TOOLS.MD":
      return 85;
    case "AGENTS.MD":
      return 70;
    case "MEMORY.MD":
      return 60;
    case "HEARTBEAT.MD":
      return 50;
    case "BOOTSTRAP.MD":
      return 40;
    default:
      return 30;
  }
}

function resolveBootstrapFloor(fileName: string, perFileMax: number): number {
  const upper = fileName.toUpperCase();
  const floor =
    upper === "AGENTS.MD"
      ? 2_000
      : upper === "SOUL.MD" ||
          upper === "IDENTITY.MD" ||
          upper === "USER.MD" ||
          upper === "TOOLS.MD"
        ? 900
        : upper === "MEMORY.MD"
          ? 600
          : 300;
  return Math.max(0, Math.min(perFileMax, floor));
}

function renderBootstrapWithinBudget(params: {
  content: string;
  fileName: string;
  maxChars: number;
  budget: number;
  warn?: (message: string) => void;
}): string {
  const source = (params.content ?? "").trimEnd();
  if (!source || params.budget <= 0) {
    return "";
  }

  const fileCap = Math.max(1, Math.min(params.maxChars, params.budget));
  const densityRatio = source.length / Math.max(1, fileCap);

  const tierOrder: Array<{ tier: "raw" | "priority" | "ultra"; text: string }> =
    densityRatio >= 8
      ? [
          { tier: "ultra", text: compactMarkdownForBootstrap(source, "ultra") },
          { tier: "priority", text: compactMarkdownForBootstrap(source, "priority") },
          { tier: "raw", text: source },
        ]
      : densityRatio >= 4
        ? [
            { tier: "priority", text: compactMarkdownForBootstrap(source, "priority") },
            { tier: "ultra", text: compactMarkdownForBootstrap(source, "ultra") },
            { tier: "raw", text: source },
          ]
        : [
            { tier: "raw", text: source },
            { tier: "priority", text: compactMarkdownForBootstrap(source, "priority") },
            { tier: "ultra", text: compactMarkdownForBootstrap(source, "ultra") },
          ];

  for (const candidate of tierOrder) {
    const trimmed = trimBootstrapContent(candidate.text, params.fileName, fileCap);
    const budgeted = clampToBudget(trimmed.content, params.budget);
    if (!budgeted) {
      continue;
    }
    if (candidate.tier !== "raw") {
      params.warn?.(
        `workspace bootstrap file ${params.fileName} self-healed via ${candidate.tier} compaction (${source.length} -> ${candidate.text.length} chars before truncation)`,
      );
    } else if (trimmed.truncated || budgeted.length < trimmed.content.length) {
      params.warn?.(
        `workspace bootstrap file ${params.fileName} is ${trimmed.originalLength} chars (limit ${fileCap}); truncating in injected context`,
      );
    }
    return budgeted;
  }

  return "";
}

function allocateBootstrapBudgets(
  files: Array<{ file: WorkspaceBootstrapFile; index: number }>,
  params: { perFileMaxChars: number; totalBudget: number },
): AllocatedBootstrapFile[] {
  if (params.totalBudget <= 0 || files.length === 0) {
    return [];
  }

  const caps = files.map(({ file }) =>
    Math.max(1, Math.min(params.perFileMaxChars, (file.content ?? "").trimEnd().length || 1)),
  );
  const allocations = Array.from({ length: files.length }, () => 0);
  let remaining = params.totalBudget;

  const ranked = files
    .map((entry, idx) => ({
      idx,
      priority: resolveBootstrapPriority(entry.file.name),
      floor: resolveBootstrapFloor(entry.file.name, caps[idx] ?? params.perFileMaxChars),
    }))
    .toSorted((a, b) => b.priority - a.priority);

  for (const item of ranked) {
    if (remaining <= 0) {
      break;
    }
    const cap = caps[item.idx] ?? 0;
    if (cap <= 0) {
      continue;
    }
    const floorTarget = Math.max(
      Math.min(item.floor, cap),
      Math.min(MIN_BOOTSTRAP_FILE_BUDGET_CHARS, cap),
    );
    const grant = Math.min(floorTarget, remaining);
    allocations[item.idx] = grant;
    remaining -= grant;
  }

  while (remaining > 0) {
    const expandable = ranked.filter((item) => allocations[item.idx] < (caps[item.idx] ?? 0));
    if (expandable.length === 0) {
      break;
    }
    const totalWeight = expandable.reduce((sum, item) => sum + item.priority, 0);
    let progressed = false;

    for (const item of expandable) {
      if (remaining <= 0) {
        break;
      }
      const cap = caps[item.idx] ?? 0;
      const available = cap - allocations[item.idx];
      if (available <= 0) {
        continue;
      }
      const proportional = Math.floor((remaining * item.priority) / Math.max(1, totalWeight));
      const grant = Math.min(available, proportional > 0 ? proportional : 1, remaining);
      if (grant <= 0) {
        continue;
      }
      allocations[item.idx] += grant;
      remaining -= grant;
      progressed = true;
    }

    if (!progressed) {
      break;
    }
  }

  return files
    .map((entry, idx) => ({ index: entry.index, file: entry.file, budget: allocations[idx] ?? 0 }))
    .toSorted((a, b) => a.index - b.index);
}

export async function ensureSessionHeader(params: {
  sessionFile: string;
  sessionId: string;
  cwd: string;
}) {
  const file = params.sessionFile;
  try {
    await fs.stat(file);
    return;
  } catch {
    // create
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const sessionVersion = 2;
  const entry = {
    type: "session",
    version: sessionVersion,
    id: params.sessionId,
    timestamp: new Date().toISOString(),
    cwd: params.cwd,
  };
  await fs.writeFile(file, `${JSON.stringify(entry)}\n`, "utf-8");
}

export function buildBootstrapContextFiles(
  files: WorkspaceBootstrapFile[],
  opts?: { warn?: (message: string) => void; maxChars?: number; totalMaxChars?: number },
): EmbeddedContextFile[] {
  const maxChars = opts?.maxChars ?? DEFAULT_BOOTSTRAP_MAX_CHARS;
  const totalMaxChars = Math.max(
    1,
    Math.floor(opts?.totalMaxChars ?? Math.max(maxChars, DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS)),
  );

  const contextFiles: EmbeddedContextFile[] = [];
  let remaining = totalMaxChars;
  const nonMissing: Array<{ file: WorkspaceBootstrapFile; index: number }> = [];

  for (const [index, file] of files.entries()) {
    if (file.missing) {
      if (remaining <= 0) {
        break;
      }
      const marker = clampToBudget(`[MISSING] Expected at: ${file.path}`, remaining);
      if (!marker) {
        break;
      }
      remaining = Math.max(0, remaining - marker.length);
      contextFiles.push({ path: file.path, content: marker });
      continue;
    }
    nonMissing.push({ file, index });
  }

  if (remaining <= 0 || nonMissing.length === 0) {
    return contextFiles;
  }
  if (remaining < MIN_BOOTSTRAP_FILE_BUDGET_CHARS) {
    opts?.warn?.(
      `remaining bootstrap budget is ${remaining} chars (<${MIN_BOOTSTRAP_FILE_BUDGET_CHARS}); forcing aggressive bootstrap compaction`,
    );
  }

  const allocations = allocateBootstrapBudgets(nonMissing, {
    perFileMaxChars: maxChars,
    totalBudget: remaining,
  });

  for (const allocated of allocations) {
    const content = renderBootstrapWithinBudget({
      content: allocated.file.content ?? "",
      fileName: allocated.file.name,
      maxChars,
      budget: allocated.budget,
      warn: opts?.warn,
    });

    if (!content) {
      continue;
    }

    contextFiles.push({ path: allocated.file.name, content });
  }

  return contextFiles;
}

export function sanitizeGoogleTurnOrdering(messages: AgentMessage[]): AgentMessage[] {
  const GOOGLE_TURN_ORDER_BOOTSTRAP_TEXT = "(session bootstrap)";
  const first = messages[0] as { role?: unknown; content?: unknown } | undefined;
  const role = first?.role;
  const content = first?.content;
  if (
    role === "user" &&
    typeof content === "string" &&
    content.trim() === GOOGLE_TURN_ORDER_BOOTSTRAP_TEXT
  ) {
    return messages;
  }
  if (role !== "assistant") {
    return messages;
  }

  // Cloud Code Assist rejects histories that begin with a model turn (tool call or text).
  // Prepend a tiny synthetic user turn so the rest of the transcript can be used.
  const bootstrap: AgentMessage = {
    role: "user",
    content: GOOGLE_TURN_ORDER_BOOTSTRAP_TEXT,
    timestamp: Date.now(),
  } as AgentMessage;

  return [bootstrap, ...messages];
}
