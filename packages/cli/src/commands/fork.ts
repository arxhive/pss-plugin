import { spawn } from "node:child_process";
import { Command } from "commander";
import type { SessionRefDto } from "../apiClient.js";
import { CliError, EXIT_CODE } from "../errors.js";
import { logAction, logFailure, logInput, logSuccess } from "../logger.js";
import { emit } from "../output.js";
import { parseReference } from "../reference.js";
import { buildContext, globalOptionsFrom, type CliContext } from "../program.js";
import { performClone } from "./clone.js";

const COMMAND = "fork";

interface ForkOptions {
  name?: string;
  agent?: string;
  into?: string;
}

/**
 * Runs the agent's open command attached to the current terminal so the agent
 * starts interactively. Resolves with the agent's exit code once the user ends
 * the session.
 */
function runInteractive(openCommand: string): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(openCommand, { shell: true, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => resolvePromise(code ?? 0));
  });
}

async function launchAgent(openCommand: string): Promise<void> {
  logAction(COMMAND, { openCommand });
  const exitCode = await runInteractive(openCommand).catch((error: Error) => {
    logFailure(COMMAND, error.message, { openCommand });
    throw new CliError(
      `Failed to run open command "${openCommand}": ${error.message}`,
      EXIT_CODE.GENERIC_FAILURE,
    );
  });
  if (exitCode !== 0) {
    logFailure(COMMAND, `open command exited with code ${exitCode}`, { openCommand });
    throw new CliError(
      `Open command "${openCommand}" exited with code ${exitCode}.`,
      EXIT_CODE.GENERIC_FAILURE,
    );
  }
}

/**
 * Clones the freshly created fork for the requested agent and opens it
 * interactively where the agent supports a native resume.
 */
async function cloneForkAndOpen(
  ctx: CliContext,
  fork: SessionRefDto,
  options: ForkOptions,
): Promise<void> {
  const forkReference = `${fork.projectSlug}/${fork.publicId}`;
  const { instruction, placed } = await performClone(
    ctx,
    forkReference,
    options.agent ?? "",
    options.into,
  );
  const lines = [
    `Forked to ${forkReference}`,
    `URL: ${fork.url}`,
    ...placed.map((artifact) => `Placed: ${artifact.absolutePath}`),
  ];
  if (!instruction.openCommand) {
    lines.push(`Notes: ${instruction.notes}`);
    emit(ctx.json, { ...fork, clone: instruction }, lines);
    return;
  }
  emit(ctx.json, { ...fork, clone: instruction }, lines);
  await launchAgent(instruction.openCommand);
}

async function runFork(
  reference: string,
  options: ForkOptions,
  command: Command,
): Promise<void> {
  const ctx = buildContext(globalOptionsFrom(command));
  logInput(COMMAND, {
    reference,
    name: options.name ?? null,
    agent: options.agent ?? null,
  });
  const { publicId } = parseReference(reference);
  logAction(COMMAND, { reference });
  const fork = await ctx.api.forkSession(publicId, options.name);
  logSuccess(COMMAND, { publicId, forkPublicId: fork.publicId });

  if (options.agent === undefined) {
    emit(ctx.json, fork, [
      `Forked to ${fork.projectSlug}/${fork.publicId}`,
      `URL: ${fork.url}`,
    ]);
    return;
  }
  await cloneForkAndOpen(ctx, fork, options);
}

export function registerFork(program: Command): void {
  program
    .command("fork")
    .description(
      "Fork a session into a new independent session; with --agent, clone the fork and open it",
    )
    .argument("<reference>", "Session reference <project-slug>/<public-id>")
    .option("--name <name>", "Name for the fork")
    .option("--agent <agent>", "Clone the fork for this agent and open it interactively")
    .option("--into <dir>", "Directory to place artifacts (default: home directory)")
    .action(async (reference: string, options: ForkOptions, command: Command) => {
      try {
        await runFork(reference, options, command);
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
