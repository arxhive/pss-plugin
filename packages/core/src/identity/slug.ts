/**
 * Project-slug derivation (FR-007, FR-008). A slug is lowercase and URL-safe,
 * matching the pattern [a-z0-9._-]+(/[a-z0-9._-]+)*. It is derived from a git
 * remote origin URL (host/owner/repo) when present, otherwise from a directory
 * name.
 */

const SLUG_SEGMENT_PATTERN = /[^a-z0-9._-]+/g;
const TRIM_DASHES_PATTERN = /^[-._]+|[-._]+$/g;
const GIT_SUFFIX = ".git";

function normalizeSegment(segment: string): string {
  const lowered = segment.toLowerCase().trim();
  const cleaned = lowered.replace(SLUG_SEGMENT_PATTERN, "-");
  return cleaned.replace(TRIM_DASHES_PATTERN, "");
}

function stripGitSuffix(value: string): string {
  return value.endsWith(GIT_SUFFIX) ? value.slice(0, -GIT_SUFFIX.length) : value;
}

/**
 * Parses a git remote origin URL into a normalized host/owner/repo slug.
 * Supports both SSH (`git@host:owner/repo.git`) and HTTPS
 * (`https://host/owner/repo.git`) forms. Returns null when the URL cannot be
 * parsed into the expected shape.
 */
export function deriveSlugFromGitRemote(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const sshMatch = trimmed.match(/^[^@]+@([^:]+):(.+)$/);
  if (sshMatch) {
    return buildSlug(sshMatch[1] ?? "", sshMatch[2] ?? "");
  }

  try {
    const url = new URL(trimmed);
    return buildSlug(url.host, url.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

function buildSlug(host: string, repoPath: string): string | null {
  const segments = stripGitSuffix(repoPath)
    .split("/")
    .map(normalizeSegment)
    .filter((segment) => segment.length > 0);
  const normalizedHost = normalizeSegment(host);

  if (normalizedHost.length === 0 || segments.length === 0) {
    return null;
  }
  return [normalizedHost, ...segments].join("/");
}

/**
 * Derives a slug from a filesystem directory name (FR-008 fallback).
 */
export function deriveSlugFromDirectory(directoryName: string): string {
  const normalized = normalizeSegment(directoryName);
  return normalized.length > 0 ? normalized : "untitled-project";
}

/**
 * Resolves a project slug: prefer the git remote when available, otherwise fall
 * back to the directory name.
 */
export function deriveProjectSlug(input: {
  gitRemoteUrl?: string | null;
  directoryName: string;
}): string {
  if (input.gitRemoteUrl) {
    const fromGit = deriveSlugFromGitRemote(input.gitRemoteUrl);
    if (fromGit) {
      return fromGit;
    }
  }
  return deriveSlugFromDirectory(input.directoryName);
}
