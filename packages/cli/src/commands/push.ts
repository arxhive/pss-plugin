import { readFile } from "node:fs/promises";
import { Command } from "commander";
import {
  AGENT_IDS,
  deriveProjectSlug,
  getAdapter,
  isAgentId,
  type AgentId,
  type DetectedSession,
  type SessionManifest,
} from "@pss/core";
import { CliError, EXIT_CODE } from "../errors.js";
import { readGitRemoteUrl, directoryName } from "../git.js";
import { logAction, logFailure, logInput, logSuccess } from "../logger.js";
import { emit } from "../output.js";
import { buildContext, globalOptionsFrom } from "../program.js";

const COMMAND = "push";

interface PushOptions {
  agent?: string;
  project?: string;
  name?: string;
  public?: boolean;
}

async function detectAgent(cwd: string): Promise<{ agent: AgentId; detected: DetectedSession }> {
  for (const agent of AGENT_IDS) {
    const detected = await getAdapter(agent).detect(cwd);
    if (detected) {
      return { agent, detected };
    }
  }
  throw new CliError(
    "No active agent session transcript found in this working directory.",
    EXIT_CODE.NO_TRANSCRIPT,
  );
}

async function resolveAgentAndTranscript(
  cwd: string,
  requested: string | undefined,
): Promise<{ agent: AgentId; transcript: string }> {
  if (requested === undefined) {
    const { agent, detected } = await detectAgent(cwd);
    return { agent, transcript: await readFile(detected.transcriptPath, "utf-8") };
  }
  if (!isAgentId(requested)) {
    throw new CliError(
      `Unknown agent "${requested}". Supported agents: ${AGENT_IDS.join(", ")}.`,
      EXIT_CODE.USAGE_ERROR,
    );
  }
  const detected = await getAdapter(requested).detect(cwd);
  if (!detected) {
    throw new CliError(
      `No active ${requested} session transcript found in this working directory.`,
      EXIT_CODE.NO_TRANSCRIPT,
    );
  }
  return { agent: requested, transcript: await readFile(detected.transcriptPath, "utf-8") };
}

async function runPush(options: PushOptions, command: Command): Promise<void> {
  const ctx = buildContext(globalOptionsFrom(command));
  const cwd = process.cwd();
  logInput(COMMAND, { agent: options.agent ?? "auto", project: options.project ?? null });

  const { agent, transcript } = await resolveAgentAndTranscript(cwd, options.agent);
  // Keep the raw transcript alongside the neutral turns so cloning back into
  // the origin agent is byte-faithful (native resume needs the full envelope).
  const manifest: SessionManifest = {
    ...getAdapter(agent).import(transcript, cwd),
    nativeSource: { agent, content: transcript },
  };

  const slug =
    options.project ??
    deriveProjectSlug({
      gitRemoteUrl: await readGitRemoteUrl(cwd),
      directoryName: directoryName(cwd),
    });
  logAction(COMMAND, { agent, slug, turns: manifest.turns.length });

  const ref = await ctx.api.pushSession({
    name: options.name ?? manifest.title ?? `${agent} session`,
    originAgent: agent,
    derivedSlug: slug,
    visibility: options.public ? "public" : "private",
    manifest,
  });

  logSuccess(COMMAND, { publicId: ref.publicId, projectSlug: ref.projectSlug });
  emit(ctx.json, ref, [
    `Pushed session ${ref.projectSlug}/${ref.publicId}`,
    `URL: ${ref.url}`,
  ]);
}

export function registerPush(program: Command): void {
  program
    .command("push")
    .description("Capture and upload the current agent session")
    .option("--agent <agent>", "Origin agent (claude-code|codex|cursor|opencode)")
    .option("--project <slug>", "Override the derived project slug")
    .option("--name <name>", "Human-readable session name")
    .option("--public", "Make the session public (default private)")
    .action(async (options: PushOptions, command: Command) => {
      try {
        await runPush(options, command);
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
