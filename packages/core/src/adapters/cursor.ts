import { join } from "node:path";
import { AdapterImportError } from "../errors.js";
import {
  MANIFEST_SCHEMA_VERSION,
  type SessionManifest,
  type Turn,
} from "../manifest/types.js";
import { buildHandoffMarkdown, normalizeRole } from "./shared.js";
import type {
  AgentAdapter,
  CloneInstruction,
  DetectedSession,
  ExportContext,
  FileArtifact,
} from "./types.js";

/**
 * Cursor adapter (research section 1.4). Cursor cannot natively resume an
 * externally authored thread by id, so this adapter IMPORTS a Cursor-exported
 * transcript but EXPORTS only an honest handoff.md bootstrap prompt (FR-015).
 * supportsNativeResume is false; the mode is always "handoff".
 */

const CURSOR_AGENT = "cursor" as const;

interface CursorExportedMessage {
  readonly role?: string;
  readonly text?: string;
  readonly content?: string;
  readonly timestamp?: string;
}

interface CursorExportedTranscript {
  readonly title?: string;
  readonly messages?: CursorExportedMessage[];
}

function messageToTurn(message: CursorExportedMessage): Turn | null {
  const text = message.text ?? message.content ?? null;
  if (text === null) {
    return null;
  }
  return {
    role: normalizeRole(message.role),
    text,
    toolCalls: [],
    timestamp: message.timestamp ?? null,
  };
}

function importCursor(nativeSource: string, originCwd: string | null): SessionManifest {
  let transcript: CursorExportedTranscript;
  try {
    transcript = JSON.parse(nativeSource) as CursorExportedTranscript;
  } catch (error) {
    throw new AdapterImportError(
      `Failed to parse Cursor exported transcript JSON: ${(error as Error).message}`,
    );
  }
  const turns = (transcript.messages ?? [])
    .map(messageToTurn)
    .filter((turn): turn is Turn => turn !== null);

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    originAgent: CURSOR_AGENT,
    originCwd,
    capturedAt: new Date().toISOString(),
    title: transcript.title ?? null,
    turns,
  };
}

function exportCursor(
  manifest: SessionManifest,
  context: ExportContext,
): CloneInstruction {
  const handoff = buildHandoffMarkdown(manifest);
  // Anchored to the target cwd (absolute path) so the open command finds the
  // file no matter where artifacts would otherwise default to.
  const handoffPath = join(context.targetCwd, "handoff.md");
  const artifacts: FileArtifact[] = [{ path: handoffPath, content: handoff }];
  return {
    agent: CURSOR_AGENT,
    mode: "handoff",
    artifacts,
    openCommand: `cursor-agent "$(cat '${handoffPath}')"`,
    notes:
      "Cursor has no supported way to resume an externally authored thread by id, so PSS produces an honest handoff.md bootstrap prompt instead of a native resume. Run the open command, or paste handoff.md into a fresh Cursor chat to continue.",
  };
}

async function detectCursor(_cwd: string): Promise<DetectedSession | null> {
  return null;
}

export const cursorAdapter: AgentAdapter = {
  id: CURSOR_AGENT,
  supportsNativeResume: false,
  detect: detectCursor,
  import: importCursor,
  export: exportCursor,
};
