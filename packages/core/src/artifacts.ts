import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import type { FileArtifact } from "./adapters/types.js";

/**
 * Places clone artifacts on disk (FR-012). Adapter artifact paths are relative
 * to the user's home directory unless an explicit base directory is given, in
 * which case they are placed relative to that directory instead. Shared by the
 * CLI and the local-mode web portal so placement semantics never diverge.
 */

export interface PlacedArtifact {
  readonly absolutePath: string;
  readonly bytes: number;
}

function resolveTarget(artifactPath: string, baseDir?: string): string {
  if (isAbsolute(artifactPath)) {
    return artifactPath;
  }
  const base = baseDir ?? homedir();
  return join(base, artifactPath);
}

export async function placeArtifacts(
  artifacts: readonly FileArtifact[],
  baseDir?: string,
): Promise<PlacedArtifact[]> {
  const placed: PlacedArtifact[] = [];
  for (const artifact of artifacts) {
    const absolutePath = resolveTarget(artifact.path, baseDir);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, artifact.content, "utf-8");
    placed.push({
      absolutePath,
      bytes: Buffer.byteLength(artifact.content, "utf-8"),
    });
  }
  return placed;
}
