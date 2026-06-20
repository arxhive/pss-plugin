import { randomUUID } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AdapterImportError } from "../errors.js";
import {
  MANIFEST_SCHEMA_VERSION,
  type SessionManifest,
  type ToolCall,
  type Turn,
} from "../manifest/types.js";
import { normalizeRole, parseJsonl, toJsonl } from "./shared.js";
import type {
  AgentAdapter,
  CloneInstruction,
  DetectedSession,
  ExportContext,
  FileArtifact,
} from "./types.js";

/**
 * Claude Code adapter (research section 1.1). Reference adapter with full native
 * import and native export: transcript JSONL placed under
 * ~/.claude/projects/<encoded-cwd>/<id>.jsonl, resumed via `claude --resume <id>`.
 */

const CLAUDE_AGENT = "claude-code" as const;

interface ClaudeRecord {
  readonly type?: string;
  readonly role?: string;
  readonly message?: { role?: string; content?: unknown };
  readonly content?: unknown;
  readonly timestamp?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly toolName?: string;
  readonly result?: unknown;
}

/**
 * Encodes a working directory into the Claude Code project directory name:
 * path separators and dots become dashes.
 */
export function encodeClaudeCwd(cwd: string): string {
  return cwd.replace(/[/\\.]/g, "-");
}

function claudeProjectsRoot(): string {
  return join(homedir(), ".claude", "projects");
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .filter((part): part is { type?: string; text?: string } => typeof part === "object" && part !== null)
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

function extractToolCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter((part): part is Record<string, unknown> => typeof part === "object" && part !== null)
    .filter((part) => part.type === "tool_use")
    .map((part) => ({
      name: typeof part.name === "string" ? part.name : "unknown",
      input: part.input ?? null,
      result: null,
    }));
}

function recordToTurn(record: ClaudeRecord): Turn | null {
  const message = record.message;
  const role = normalizeRole(message?.role ?? record.role);
  const content = message?.content ?? record.content;
  const text = extractText(content);
  const toolCalls = extractToolCalls(content);
  if (text === null && toolCalls.length === 0) {
    return null;
  }
  return {
    role,
    text,
    toolCalls,
    timestamp: record.timestamp ?? null,
  };
}

function importClaude(nativeSource: string, originCwd: string | null): SessionManifest {
  let records: unknown[];
  try {
    records = parseJsonl(nativeSource);
  } catch (error) {
    throw new AdapterImportError(
      `Failed to parse Claude Code JSONL transcript: ${(error as Error).message}`,
    );
  }
  const turns = records
    .filter((record): record is ClaudeRecord => typeof record === "object" && record !== null)
    .filter((record) => record.type === "user" || record.type === "assistant" || record.message !== undefined || record.role !== undefined)
    .map(recordToTurn)
    .filter((turn): turn is Turn => turn !== null);

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    originAgent: CLAUDE_AGENT,
    originCwd,
    capturedAt: new Date().toISOString(),
    title: null,
    turns,
  };
}

/**
 * Marks transcript lines synthesized by pss (as opposed to captured from a real
 * Claude Code run) so they are distinguishable in the placed file.
 */
const SYNTHESIZED_VERSION = "0.0.0-pss";

/**
 * Rewrites a captured native transcript for placement under a new session id
 * and working directory. All other fields are preserved byte-faithfully, which
 * is what makes `claude --resume` accept the cloned session.
 */
function rewriteNativeTranscript(content: string, context: ExportContext): string {
  let records: unknown[];
  try {
    records = parseJsonl(content);
  } catch (error) {
    throw new AdapterImportError(
      `Stored Claude Code transcript is not valid JSONL: ${(error as Error).message}`,
    );
  }
  const rewritten = records.map((record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const line = { ...(record as Record<string, unknown>) };
    if ("sessionId" in line) {
      line.sessionId = context.nativeSessionId;
    }
    if ("cwd" in line) {
      line.cwd = context.targetCwd;
    }
    return line;
  });
  return toJsonl(rewritten);
}

function turnToPlainText(turn: Turn): string | null {
  const parts: string[] = [];
  if (turn.text !== null && turn.text.length > 0) {
    parts.push(turn.text);
  }
  for (const call of turn.toolCalls) {
    parts.push(`[tool ${call.name} input: ${JSON.stringify(call.input)}]`);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Builds a resumable transcript from the neutral manifest when no native Claude
 * Code source exists (session originated from another agent). Claude Code only
 * indexes lines carrying the full envelope (sessionId, uuid chain, cwd), and
 * replay requires text-only content blocks, so tool calls are rendered as text.
 */
function synthesizeTranscript(
  manifest: SessionManifest,
  context: ExportContext,
): string {
  const records: unknown[] = [];
  let parentUuid: string | null = null;
  for (const turn of manifest.turns) {
    const text = turnToPlainText(turn);
    if (text === null) {
      continue;
    }
    const role = turn.role === "assistant" ? "assistant" : "user";
    const uuid = randomUUID();
    records.push({
      type: role,
      message: { role, content: [{ type: "text", text }] },
      sessionId: context.nativeSessionId,
      uuid,
      parentUuid,
      cwd: context.targetCwd,
      userType: "external",
      isSidechain: false,
      version: SYNTHESIZED_VERSION,
      timestamp: turn.timestamp ?? manifest.capturedAt,
    });
    parentUuid = uuid;
  }
  return toJsonl(records);
}

function exportClaude(
  manifest: SessionManifest,
  context: ExportContext,
): CloneInstruction {
  const content =
    manifest.nativeSource?.agent === CLAUDE_AGENT
      ? rewriteNativeTranscript(manifest.nativeSource.content, context)
      : synthesizeTranscript(manifest, context);
  const encoded = encodeClaudeCwd(context.targetCwd);
  const artifactPath = join(
    ".claude",
    "projects",
    encoded,
    `${context.nativeSessionId}.jsonl`,
  );
  const artifacts: FileArtifact[] = [{ path: artifactPath, content }];
  return {
    agent: CLAUDE_AGENT,
    mode: "native-resume",
    artifacts,
    openCommand: `claude --resume ${context.nativeSessionId}`,
    notes: `Transcript belongs at ~/${artifactPath} (relative to the home directory); run the open command from ${context.targetCwd}.`,
  };
}

async function detectClaude(cwd: string): Promise<DetectedSession | null> {
  const dir = join(claudeProjectsRoot(), encodeClaudeCwd(cwd));
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }
  const jsonlFiles = entries.filter((entry) => entry.endsWith(".jsonl"));
  if (jsonlFiles.length === 0) {
    return null;
  }
  const newest = await pickNewest(dir, jsonlFiles);
  return {
    transcriptPath: join(dir, newest),
    nativeSessionId: newest.replace(/\.jsonl$/, ""),
  };
}

async function pickNewest(dir: string, files: string[]): Promise<string> {
  let newest = files[0] as string;
  let newestMtime = 0;
  for (const file of files) {
    const info = await stat(join(dir, file));
    if (info.mtimeMs > newestMtime) {
      newestMtime = info.mtimeMs;
      newest = file;
    }
  }
  return newest;
}

export const claudeCodeAdapter: AgentAdapter = {
  id: CLAUDE_AGENT,
  supportsNativeResume: true,
  detect: detectClaude,
  import: importClaude,
  export: exportClaude,
};

/**
 * Reads a detected transcript from disk (used by `pss push`).
 */
export async function readClaudeTranscript(path: string): Promise<string> {
  return readFile(path, "utf-8");
}
