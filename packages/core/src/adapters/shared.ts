import type { SessionManifest, Turn, TurnRole } from "../manifest/types.js";

/**
 * Helpers shared by adapters: role normalization, JSONL parsing, and a
 * deterministic handoff prompt builder so the Cursor fallback and any degraded
 * native adapter produce the same honest bootstrap document (FR-015).
 */

/**
 * Normalizes a raw role string into a typed TurnRole, defaulting to "user".
 */
export function normalizeRole(raw: string | undefined): TurnRole {
  if (raw === "assistant" || raw === "system" || raw === "tool") {
    return raw;
  }
  return "user";
}

export function parseJsonl(source: string): unknown[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

export function toJsonl(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

function renderTurn(turn: Turn, index: number): string {
  const header = `### Turn ${index + 1} - ${turn.role}`;
  const body = turn.text ?? "";
  const tools = turn.toolCalls.map((call) => {
    const input = JSON.stringify(call.input);
    return `- tool \`${call.name}\` input: ${input}`;
  });
  return [header, body, ...tools].filter((part) => part.length > 0).join("\n");
}

/**
 * Builds a human-readable handoff/bootstrap prompt that fully summarizes a
 * session so any agent (including those without native resume) can continue it.
 */
export function buildHandoffMarkdown(manifest: SessionManifest): string {
  const title = manifest.title ?? "Untitled session";
  const lines = [
    `# Session handoff: ${title}`,
    "",
    `Origin agent: ${manifest.originAgent}`,
    `Captured at: ${manifest.capturedAt}`,
    manifest.originCwd ? `Origin working directory: ${manifest.originCwd}` : "",
    "",
    "You are resuming the following agent session. Read the full transcript",
    "below, then continue the work where it left off.",
    "",
    "## Transcript",
    "",
    ...manifest.turns.map(renderTurn),
  ];
  return lines.filter((line) => line.length > 0).join("\n");
}
