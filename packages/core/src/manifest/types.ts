/**
 * Agent-neutral session manifest types. This is the single source of truth for
 * the stored session payload format (data-model.md, research section 2). Every
 * adapter maps a native transcript to and from these types.
 */

export const MANIFEST_SCHEMA_VERSION = "1.1.0";

export const AGENT_IDS = ["claude-code", "codex", "cursor", "opencode"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const TURN_ROLES = ["user", "assistant", "system", "tool"] as const;
export type TurnRole = (typeof TURN_ROLES)[number];

/**
 * A single tool invocation captured within a turn.
 */
export interface ToolCall {
  readonly name: string;
  readonly input: unknown;
  readonly result: unknown;
}

/**
 * One ordered conversation turn in the neutral manifest.
 */
export interface Turn {
  readonly role: TurnRole;
  readonly text: string | null;
  readonly toolCalls: ToolCall[];
  readonly timestamp: string | null;
}

/**
 * The raw native transcript captured at push time. Preserved alongside the
 * neutral turns so a clone back into the origin agent is byte-faithful
 * (full-fidelity native resume) instead of a lossy re-synthesis.
 */
export interface NativeSource {
  readonly agent: AgentId;
  readonly content: string;
}

/**
 * The agent-neutral, versioned session document stored as an immutable blob.
 */
export interface SessionManifest {
  readonly schemaVersion: string;
  readonly originAgent: AgentId;
  readonly originCwd: string | null;
  readonly capturedAt: string;
  readonly title: string | null;
  readonly turns: Turn[];
  /** Absent on manifests captured before schema 1.1.0. */
  readonly nativeSource?: NativeSource | null;
}
