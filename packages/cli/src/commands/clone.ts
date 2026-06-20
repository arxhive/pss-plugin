import { randomUUID } from "node:crypto";
import { Command } from "commander";
import {
  AGENT_IDS,
  getAdapter,
  isAgentId,
  placeArtifacts,
  type CloneInstruction,
  type PlacedArtifact,
} from "@pss/core";
import { CliError, EXIT_CODE } from "../errors.js";
import { logAction, logFailure, logInput, logSuccess } from "../logger.js";
import { emit } from "../output.js";
import { parseReference } from "../reference.js";
import { buildContext, globalOptionsFrom, type CliContext } from "../program.js";

const COMMAND = "clone";

interface CloneOptions {
  agent?: string;
  into?: string;
}

function ensureAgent(agent: string | undefined): string {
  if (agent === undefined) {
    throw new CliError("--agent is required for clone", EXIT_CODE.USAGE_ERROR);
  }
  if (!isAgentId(agent)) {
    throw new CliError(
      `Unknown agent "${agent}". Supported agents: ${AGENT_IDS.join(", ")}.`,
      EXIT_CODE.USAGE_ERROR,
    );
  }
  return agent;
}

export interface CloneResult {
  readonly instruction: CloneInstruction;
  readonly placed: PlacedArtifact[];
}

/**
 * Fetches the converted CloneInstruction from the server and places its
 * artifacts on disk. Shared by both `clone` and `open`.
 */
export async function performClone(
  ctx: CliContext,
  reference: string,
  agentValue: string,
  intoDir?: string,
): Promise<CloneResult> {
  const agent = ensureAgent(agentValue);
  const { publicId } = parseReference(reference);
  logAction(COMMAND, { reference, agent });
  // Convert locally to mint a fresh native session id for placement.
  const manifest = await ctx.api.getPayload(publicId);
  const instruction = getAdapter(agent).export(manifest, {
    targetCwd: process.cwd(),
    nativeSessionId: randomUUID(),
  });
  const placed = await placeArtifacts(instruction.artifacts, intoDir);
  return { instruction, placed };
}

function describeClone(result: CloneResult): string[] {
  const { instruction, placed } = result;
  const lines = [
    `Cloned for ${instruction.agent} (mode: ${instruction.mode})`,
    ...placed.map((artifact) => `Placed: ${artifact.absolutePath}`),
  ];
  if (instruction.openCommand) {
    lines.push(`Resume with: ${instruction.openCommand}`);
  } else {
    lines.push(`Notes: ${instruction.notes}`);
  }
  return lines;
}

async function runClone(
  reference: string,
  options: CloneOptions,
  command: Command,
): Promise<void> {
  const ctx = buildContext(globalOptionsFrom(command));
  logInput(COMMAND, { reference, agent: options.agent ?? null });
  const result = await performClone(ctx, reference, options.agent ?? "", options.into);
  logSuccess(COMMAND, { agent: result.instruction.agent, mode: result.instruction.mode });
  emit(ctx.json, result.instruction, describeClone(result));
}

export function registerClone(program: Command): void {
  program
    .command("clone")
    .description("Download a session and convert it for a target agent")
    .argument("<reference>", "Session reference <project-slug>/<public-id>")
    .requiredOption("--agent <agent>", "Target agent")
    .option("--into <dir>", "Directory to place artifacts (default: home directory)")
    .action(async (reference: string, options: CloneOptions, command: Command) => {
      try {
        await runClone(reference, options, command);
      } catch (error) {
        if (error instanceof CliError) {
          logFailure(COMMAND, error.message);
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        logFailure(COMMAND, message);
        throw new CliError(message, EXIT_CODE.GENERIC_FAILURE);
      }
    });
}
