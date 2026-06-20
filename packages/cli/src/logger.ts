/**
 * Structured CLI logging (contracts/cli.md): every command logs input received,
 * action taken, and outcome to stderr so human-readable output on stdout stays
 * clean and machine-parseable diagnostics are available for autonomous QA.
 */

type LogFields = Record<string, unknown>;

function emit(level: "info" | "error", event: string, fields: LogFields): void {
  const line = JSON.stringify({ level, event, ...fields });
  process.stderr.write(`${line}\n`);
}

export function logInput(command: string, fields: LogFields = {}): void {
  emit("info", `cli.${command}.input`, fields);
}

export function logAction(command: string, fields: LogFields = {}): void {
  emit("info", `cli.${command}.action`, fields);
}

export function logSuccess(command: string, fields: LogFields = {}): void {
  emit("info", `cli.${command}.success`, fields);
}

export function logFailure(command: string, message: string, fields: LogFields = {}): void {
  emit("error", `cli.${command}.failure`, { message, ...fields });
}
