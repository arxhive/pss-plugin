import type { AgentId, SessionManifest } from "../manifest/types.js";

/**
 * Adapter contract (data-model.md). Every agent adapter converts a native
 * transcript to the neutral manifest (`import`) and back to native artifacts or
 * a handoff fallback (`export`), and declares whether it supports a true native
 * cross-agent resume (research section 1.5).
 */

export const CLONE_MODES = ["native-resume", "handoff"] as const;
export type CloneMode = (typeof CLONE_MODES)[number];

/**
 * A single file the clone places, with the path the target agent expects.
 */
export interface FileArtifact {
  readonly path: string;
  readonly content: string;
}

/**
 * The user-facing output of a clone: converted artifacts plus the honest open
 * instruction (data-model.md, FR-013, FR-015).
 */
export interface CloneInstruction {
  readonly agent: AgentId;
  readonly mode: CloneMode;
  readonly artifacts: FileArtifact[];
  readonly openCommand: string | null;
  readonly notes: string;
}

/**
 * The result of locating an active native session for an agent in the current
 * environment (used by `pss push` auto-detection).
 */
export interface DetectedSession {
  readonly transcriptPath: string;
  readonly nativeSessionId: string;
}

/**
 * Context an adapter needs to produce target-agent artifacts.
 */
export interface ExportContext {
  /** Working directory the cloned session should target on disk. */
  readonly targetCwd: string;
  /** New native session id to mint for the placed artifacts. */
  readonly nativeSessionId: string;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly supportsNativeResume: boolean;

  /**
   * Locates an active native session for this agent in the given working
   * directory, or returns null when none is found.
   */
  detect(cwd: string): Promise<DetectedSession | null>;

  /**
   * Converts a native transcript (raw file contents) into the neutral manifest.
   */
  import(nativeSource: string, originCwd: string | null): SessionManifest;

  /**
   * Converts the neutral manifest into native artifacts or a handoff fallback.
   */
  export(manifest: SessionManifest, context: ExportContext): CloneInstruction;
}
