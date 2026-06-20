import { UnsupportedAgentError } from "../errors.js";
import { AGENT_IDS, type AgentId } from "../manifest/types.js";
import type { AgentAdapter } from "./types.js";

/**
 * Registry of the four supported agent adapters (FR-016). Adapters self-register
 * here at module load so both the CLI and the web API resolve the same single
 * source of truth.
 */
const registry = new Map<AgentId, AgentAdapter>();

export function registerAdapter(adapter: AgentAdapter): void {
  registry.set(adapter.id, adapter);
}

/**
 * Returns true when the candidate is one of the four supported agent ids.
 */
export function isAgentId(candidate: string): candidate is AgentId {
  return (AGENT_IDS as readonly string[]).includes(candidate);
}

/**
 * Resolves the adapter for an agent id, throwing UnsupportedAgentError (with the
 * supported list) for unknown or unregistered agents.
 */
export function getAdapter(agent: string): AgentAdapter {
  if (!isAgentId(agent)) {
    throw new UnsupportedAgentError(agent, AGENT_IDS);
  }
  const adapter = registry.get(agent);
  if (!adapter) {
    throw new UnsupportedAgentError(agent, [...registry.keys()]);
  }
  return adapter;
}

export function listRegisteredAgents(): AgentId[] {
  return [...registry.keys()];
}

export function supportedAgents(): readonly AgentId[] {
  return AGENT_IDS;
}
