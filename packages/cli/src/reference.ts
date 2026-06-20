import { isValidPublicId } from "@pss/core";
import { CliError, EXIT_CODE } from "./errors.js";

/**
 * Parses a session reference of the form `<project-slug>/<public-id>`. The slug
 * may itself contain slashes (host/owner/repo), so the public id is the final
 * path segment.
 */
export interface SessionReference {
  readonly projectSlug: string;
  readonly publicId: string;
}

export function parseReference(reference: string): SessionReference {
  const lastSlash = reference.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash === reference.length - 1) {
    throw new CliError(
      `Invalid session reference "${reference}". Expected <project-slug>/<public-id>.`,
      EXIT_CODE.USAGE_ERROR,
    );
  }
  const publicId = reference.slice(lastSlash + 1);
  if (!isValidPublicId(publicId)) {
    throw new CliError(
      `Invalid session reference "${reference}". The public id is malformed.`,
      EXIT_CODE.USAGE_ERROR,
    );
  }
  return { projectSlug: reference.slice(0, lastSlash), publicId };
}
