/**
 * CLI exit codes (contracts/cli.md) and a typed error that carries one.
 */

export const EXIT_CODE = {
  SUCCESS: 0,
  GENERIC_FAILURE: 1,
  USAGE_ERROR: 2,
  NOT_FOUND: 3,
  PAYLOAD_TOO_LARGE: 4,
  NO_TRANSCRIPT: 5,
} as const;

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];

export class CliError extends Error {
  public readonly exitCode: ExitCode;

  public constructor(message: string, exitCode: ExitCode = EXIT_CODE.GENERIC_FAILURE) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}
