/**
 * Human/JSON output helper. Commands print machine-readable JSON to stdout when
 * --json is set, otherwise human-readable lines.
 */
export function emit(json: boolean, data: unknown, humanLines: string[]): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }
  process.stdout.write(`${humanLines.join("\n")}\n`);
}
