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
 * Codex CLI adapter (research section 1.2). Native import parses rollout JSONL;
 * native export emits a rollout JSONL plus `codex resume <id>`. Declares native
 * resume with a documented version caveat; the open notes state the fallback.
 */

const CODEX_AGENT = "codex" as const;

interface CodexRecord {
  readonly type?: string;
  readonly role?: string;
  readonly content?: unknown;
  readonly text?: string;
  readonly timestamp?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly output?: unknown;
}

function extractText(record: CodexRecord): string | null {
  if (typeof record.text === "string") {
    return record.text;
  }
  if (typeof record.content === "string") {
    return record.content;
  }
  if (Array.isArray(record.content)) {
    const parts = record.content
      .filter((part): part is { text?: string } => typeof part === "object" && part !== null)
      .map((part) => part.text)
      .filter((text): text is string => typeof text === "string");
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

function recordToTurn(record: CodexRecord): Turn | null {
  if (record.type === "function_call" || record.type === "tool_call") {
    const toolCall: ToolCall = {
      name: typeof record.name === "string" ? record.name : "unknown",
      input: record.input ?? null,
      result: record.output ?? null,
    };
    return { role: "assistant", text: null, toolCalls: [toolCall], timestamp: record.timestamp ?? null };
  }
  const text = extractText(record);
  if (text === null) {
    return null;
  }
  return {
    role: normalizeRole(record.role),
    text,
    toolCalls: [],
    timestamp: record.timestamp ?? null,
  };
}

function importCodex(nativeSource: string, originCwd: string | null): SessionManifest {
  let records: unknown[];
  try {
    records = parseJsonl(nativeSource);
  } catch (error) {
    throw new AdapterImportError(
      `Failed to parse Codex rollout JSONL: ${(error as Error).message}`,
    );
  }
  const turns = records
    .filter((record): record is CodexRecord => typeof record === "object" && record !== null)
    .map(recordToTurn)
    .filter((turn): turn is Turn => turn !== null);

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    originAgent: CODEX_AGENT,
    originCwd,
    capturedAt: new Date().toISOString(),
    title: null,
    turns,
  };
}

function turnToRecords(turn: Turn): CodexRecord[] {
  const records: CodexRecord[] = [];
  if (turn.text !== null) {
    records.push({
      type: "message",
      role: turn.role,
      content: turn.text,
      timestamp: turn.timestamp ?? new Date().toISOString(),
    });
  }
  for (const call of turn.toolCalls) {
    records.push({
      type: "function_call",
      name: call.name,
      input: call.input,
      output: call.result,
      timestamp: turn.timestamp ?? new Date().toISOString(),
    });
  }
  return records;
}

function rolloutPath(nativeSessionId: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return join(
    ".codex",
    "sessions",
    year,
    month,
    day,
    `rollout-${nativeSessionId}.jsonl`,
  );
}

function exportCodex(
  manifest: SessionManifest,
  context: ExportContext,
): CloneInstruction {
  const records = manifest.turns.flatMap(turnToRecords);
  const artifactPath = rolloutPath(context.nativeSessionId);
  const artifacts: FileArtifact[] = [
    { path: artifactPath, content: toJsonl(records) },
  ];
  return {
    agent: CODEX_AGENT,
    mode: "native-resume",
    artifacts,
    openCommand: `codex resume ${context.nativeSessionId}`,
    notes: `Place the rollout at ~/${artifactPath}, then run the open command. If your Codex version does not recognize the placed rollout, paste the transcript into a fresh Codex session as a fallback.`,
  };
}

async function detectCodex(_cwd: string): Promise<DetectedSession | null> {
  // Codex sessions are dated and not cwd-encoded; auto-detection requires
  // scanning the newest rollout, which the CLI performs with filesystem access.
  return null;
}

export const codexAdapter: AgentAdapter = {
  id: CODEX_AGENT,
  supportsNativeResume: true,
  detect: detectCodex,
  import: importCodex,
  export: exportCodex,
};
