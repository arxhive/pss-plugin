import { join } from "node:path";
import { AdapterImportError } from "../errors.js";
import {
  MANIFEST_SCHEMA_VERSION,
  type SessionManifest,
  type ToolCall,
  type Turn,
} from "../manifest/types.js";
import { normalizeRole } from "./shared.js";
import type {
  AgentAdapter,
  CloneInstruction,
  DetectedSession,
  ExportContext,
  FileArtifact,
} from "./types.js";

/**
 * OpenCode adapter (research section 1.3). OpenCode stores a session as a tree
 * of JSON files (session, message, part). Import reads a serialized tree;
 * export reconstructs the tree under the storage root and resumes via
 * `opencode -c`, with a bootstrap fallback documented in the notes.
 */

const OPENCODE_AGENT = "opencode" as const;
const STORAGE_ROOT = join(".local", "share", "opencode", "storage");

interface OpenCodePart {
  readonly id?: string;
  readonly type?: string;
  readonly text?: string;
  readonly tool?: string;
  readonly input?: unknown;
  readonly output?: unknown;
}

interface OpenCodeMessage {
  readonly id?: string;
  readonly role?: string;
  readonly time?: { created?: number };
  readonly parts?: OpenCodePart[];
}

interface OpenCodeTree {
  readonly session?: { id?: string; projectID?: string; title?: string };
  readonly messages?: OpenCodeMessage[];
}

function partsToTurn(message: OpenCodeMessage): Turn | null {
  const parts = message.parts ?? [];
  const texts = parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string);
  const toolCalls: ToolCall[] = parts
    .filter((part) => part.type === "tool")
    .map((part) => ({
      name: typeof part.tool === "string" ? part.tool : "unknown",
      input: part.input ?? null,
      result: part.output ?? null,
    }));
  const text = texts.length > 0 ? texts.join("\n") : null;
  if (text === null && toolCalls.length === 0) {
    return null;
  }
  const createdMs = message.time?.created;
  return {
    role: normalizeRole(message.role),
    text,
    toolCalls,
    timestamp: typeof createdMs === "number" ? new Date(createdMs).toISOString() : null,
  };
}

function importOpenCode(nativeSource: string, originCwd: string | null): SessionManifest {
  let tree: OpenCodeTree;
  try {
    tree = JSON.parse(nativeSource) as OpenCodeTree;
  } catch (error) {
    throw new AdapterImportError(
      `Failed to parse OpenCode session tree JSON: ${(error as Error).message}`,
    );
  }
  const messages = tree.messages ?? [];
  const turns = messages
    .map(partsToTurn)
    .filter((turn): turn is Turn => turn !== null);

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    originAgent: OPENCODE_AGENT,
    originCwd,
    capturedAt: new Date().toISOString(),
    title: tree.session?.title ?? null,
    turns,
  };
}

function turnToMessage(turn: Turn, index: number, sessionId: string): OpenCodeMessage {
  const parts: OpenCodePart[] = [];
  if (turn.text !== null) {
    parts.push({ id: `prt_${sessionId}_${index}_text`, type: "text", text: turn.text });
  }
  for (const [toolIndex, call] of turn.toolCalls.entries()) {
    parts.push({
      id: `prt_${sessionId}_${index}_tool_${toolIndex}`,
      type: "tool",
      tool: call.name,
      input: call.input,
      output: call.result,
    });
  }
  const created = turn.timestamp ? Date.parse(turn.timestamp) : Date.now();
  return {
    id: `msg_${sessionId}_${index}`,
    role: turn.role,
    time: { created: Number.isNaN(created) ? Date.now() : created },
    parts,
  };
}

function buildArtifacts(
  manifest: SessionManifest,
  sessionId: string,
): FileArtifact[] {
  const projectId = "default";
  const messages = manifest.turns.map((turn, index) =>
    turnToMessage(turn, index, sessionId),
  );
  const artifacts: FileArtifact[] = [
    {
      path: join(STORAGE_ROOT, "session", projectId, `${sessionId}.json`),
      content: JSON.stringify({
        id: sessionId,
        projectID: projectId,
        title: manifest.title ?? "Imported PSS session",
      }),
    },
  ];
  for (const message of messages) {
    artifacts.push({
      path: join(STORAGE_ROOT, "message", sessionId, `${message.id}.json`),
      content: JSON.stringify({ id: message.id, role: message.role, time: message.time }),
    });
    for (const part of message.parts ?? []) {
      artifacts.push({
        path: join(STORAGE_ROOT, "part", message.id as string, `${part.id}.json`),
        content: JSON.stringify(part),
      });
    }
  }
  return artifacts;
}

function exportOpenCode(
  manifest: SessionManifest,
  context: ExportContext,
): CloneInstruction {
  const artifacts = buildArtifacts(manifest, context.nativeSessionId);
  return {
    agent: OPENCODE_AGENT,
    mode: "native-resume",
    artifacts,
    openCommand: "opencode -c",
    notes: `Place the session tree under ~/${STORAGE_ROOT}, then run "opencode -c" or use /resume to continue session ${context.nativeSessionId}. If the placed tree is not recognized, paste the transcript into a fresh OpenCode session.`,
  };
}

async function detectOpenCode(_cwd: string): Promise<DetectedSession | null> {
  return null;
}

export const opencodeAdapter: AgentAdapter = {
  id: OPENCODE_AGENT,
  supportsNativeResume: true,
  detect: detectOpenCode,
  import: importOpenCode,
  export: exportOpenCode,
};
