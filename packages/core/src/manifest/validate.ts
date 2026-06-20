import { ManifestValidationError } from "../errors.js";
import {
  AGENT_IDS,
  MANIFEST_SCHEMA_VERSION,
  TURN_ROLES,
  type AgentId,
  type NativeSource,
  type SessionManifest,
  type ToolCall,
  type Turn,
  type TurnRole,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ManifestValidationError(`Field "${field}" must be a string.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return requireString(value, field);
}

function requireAgentId(value: unknown, field: string): AgentId {
  const candidate = requireString(value, field);
  if (!AGENT_IDS.includes(candidate as AgentId)) {
    throw new ManifestValidationError(
      `Field "${field}" must be one of: ${AGENT_IDS.join(", ")}.`,
    );
  }
  return candidate as AgentId;
}

function requireRole(value: unknown): TurnRole {
  const candidate = requireString(value, "turn.role");
  if (!TURN_ROLES.includes(candidate as TurnRole)) {
    throw new ManifestValidationError(
      `Turn role must be one of: ${TURN_ROLES.join(", ")}.`,
    );
  }
  return candidate as TurnRole;
}

function parseToolCall(raw: unknown): ToolCall {
  if (!isRecord(raw)) {
    throw new ManifestValidationError("Each tool call must be an object.");
  }
  return {
    name: requireString(raw.name, "toolCall.name"),
    input: raw.input ?? null,
    result: raw.result ?? null,
  };
}

function parseTurn(raw: unknown): Turn {
  if (!isRecord(raw)) {
    throw new ManifestValidationError("Each turn must be an object.");
  }
  const toolCallsRaw = raw.toolCalls;
  const toolCalls = Array.isArray(toolCallsRaw)
    ? toolCallsRaw.map(parseToolCall)
    : [];
  return {
    role: requireRole(raw.role),
    text: optionalString(raw.text, "turn.text"),
    toolCalls,
    timestamp: optionalString(raw.timestamp, "turn.timestamp"),
  };
}

function parseNativeSource(raw: unknown): NativeSource | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (!isRecord(raw)) {
    throw new ManifestValidationError(`Field "nativeSource" must be an object.`);
  }
  return {
    agent: requireAgentId(raw.agent, "nativeSource.agent"),
    content: requireString(raw.content, "nativeSource.content"),
  };
}

function isSupportedSchemaVersion(version: string): boolean {
  const major = version.split(".")[0];
  const supportedMajor = MANIFEST_SCHEMA_VERSION.split(".")[0];
  return major === supportedMajor;
}

/**
 * Validates and normalizes an untrusted value into a SessionManifest. Throws
 * ManifestValidationError on any structural problem so callers fail explicitly.
 */
export function parseManifest(raw: unknown): SessionManifest {
  if (!isRecord(raw)) {
    throw new ManifestValidationError("Manifest must be a JSON object.");
  }

  const schemaVersion = requireString(raw.schemaVersion, "schemaVersion");
  if (!isSupportedSchemaVersion(schemaVersion)) {
    throw new ManifestValidationError(
      `Unsupported schemaVersion "${schemaVersion}"; this build supports ${MANIFEST_SCHEMA_VERSION}.`,
    );
  }

  const turnsRaw = raw.turns;
  if (!Array.isArray(turnsRaw)) {
    throw new ManifestValidationError(`Field "turns" must be an array.`);
  }

  return {
    schemaVersion,
    originAgent: requireAgentId(raw.originAgent, "originAgent"),
    originCwd: optionalString(raw.originCwd, "originCwd"),
    capturedAt: requireString(raw.capturedAt, "capturedAt"),
    title: optionalString(raw.title, "title"),
    turns: turnsRaw.map(parseTurn),
    nativeSource: parseNativeSource(raw.nativeSource),
  };
}

/**
 * Serializes a manifest to its canonical JSON string form for blob storage.
 */
export function serializeManifest(manifest: SessionManifest): string {
  return JSON.stringify(manifest);
}
