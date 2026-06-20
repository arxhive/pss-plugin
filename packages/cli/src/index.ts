import type { Command } from "commander";
import { CliError, EXIT_CODE } from "./errors.js";
import { logFailure } from "./logger.js";

/**
 * Runs the CLI, translating CliError exit codes into process exit codes and
 * logging unexpected failures with context.
 */
export async function runCli(argv: string[], program: Command): Promise<number> {
  program.exitOverride();
  try {
    await program.parseAsync(argv);
    return EXIT_CODE.SUCCESS;
  } catch (error) {
    return handleCliError(error);
  }
}

function handleCliError(error: unknown): number {
  if (error instanceof CliError) {
    process.stderr.write(`error: ${error.message}\n`);
    return error.exitCode;
  }
  if (isCommanderExit(error)) {
    return error.exitCode;
  }
  const message = error instanceof Error ? error.message : String(error);
  logFailure("run", message);
  process.stderr.write(`error: ${message}\n`);
  return EXIT_CODE.GENERIC_FAILURE;
}

interface CommanderExit {
  readonly exitCode: number;
  readonly code: string;
}

function isCommanderExit(error: unknown): error is CommanderExit {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("commander.")
  );
}
