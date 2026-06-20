import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Git/directory helpers for project-slug derivation on the CLI side (FR-007,
 * FR-008). Reads the remote origin URL when present.
 */

export async function readGitRemoteUrl(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["config", "--get", "remote.origin.url"],
      { cwd },
    );
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function directoryName(cwd: string): string {
  return basename(cwd);
}
