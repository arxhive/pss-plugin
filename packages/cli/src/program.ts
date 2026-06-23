import { Command } from "commander";
import { ApiClient } from "./apiClient.js";
import { resolveEndpoint, resolveToken } from "./config.js";

/**
 * CLI program shell (T018): builds the commander program with global options and
 * a shared context (resolved endpoint + API client + json flag) that every
 * command reads. Commands are registered by the index module.
 */

export interface CliContext {
  readonly endpoint: string;
  readonly json: boolean;
  readonly token: string | undefined;
  readonly api: ApiClient;
}

export interface GlobalOptions {
  endpoint?: string;
  json?: boolean;
  token?: string;
}

export function buildContext(options: GlobalOptions): CliContext {
  const endpoint = resolveEndpoint(options.endpoint);
  const token = resolveToken(options.token);
  return {
    endpoint,
    json: options.json ?? false,
    token,
    api: new ApiClient(endpoint, token),
  };
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name("pss")
    .description("GitHub for agent sessions - capture, clone, and fork agent sessions")
    .version("0.1.1")
    .option("--endpoint <url>", "Override the API base URL")
    .option(
      "--token <value>",
      "Bearer token for authenticated operations (overrides PSS_TOKEN and stored login)",
    )
    .option("--json", "Emit machine-readable JSON instead of human output");
  return program;
}

/**
 * Reads merged global options from a subcommand (commander merges parent opts).
 */
export function globalOptionsFrom(command: Command): GlobalOptions {
  const opts = command.optsWithGlobals() as GlobalOptions;
  return { endpoint: opts.endpoint, json: opts.json, token: opts.token };
}
