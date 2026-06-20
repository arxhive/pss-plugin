import { Command } from "commander";
import { ApiClient } from "./apiClient.js";
import { resolveEndpoint } from "./config.js";

/**
 * CLI program shell (T018): builds the commander program with global options and
 * a shared context (resolved endpoint + API client + json flag) that every
 * command reads. Commands are registered by the index module.
 */

export interface CliContext {
  readonly endpoint: string;
  readonly json: boolean;
  readonly api: ApiClient;
}

export interface GlobalOptions {
  endpoint?: string;
  json?: boolean;
}

export function buildContext(options: GlobalOptions): CliContext {
  const endpoint = resolveEndpoint(options.endpoint);
  return {
    endpoint,
    json: options.json ?? false,
    api: new ApiClient(endpoint),
  };
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name("pss")
    .description("GitHub for agent sessions - capture, clone, and fork agent sessions")
    .version("0.1.0")
    .option("--endpoint <url>", "Override the API base URL")
    .option("--json", "Emit machine-readable JSON instead of human output");
  return program;
}

/**
 * Reads merged global options from a subcommand (commander merges parent opts).
 */
export function globalOptionsFrom(command: Command): GlobalOptions {
  const opts = command.optsWithGlobals() as GlobalOptions;
  return { endpoint: opts.endpoint, json: opts.json };
}
