import { randomBytes } from "node:crypto";

/**
 * Opaque, URL-safe, collision-resistant public session id generation (FR-004).
 * "private" sessions rely on these ids being unguessable (research section 9),
 * so we use cryptographically strong randomness encoded as base62.
 */

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const PUBLIC_ID_LENGTH = 22;

/**
 * Generates a fixed-length base62 public id from cryptographic randomness.
 * 22 base62 chars is ~131 bits of entropy, which is collision-resistant and
 * unguessable for the MVP's unlisted-private model.
 */
export function generatePublicId(length: number = PUBLIC_ID_LENGTH): string {
  if (length <= 0) {
    throw new Error("public id length must be positive");
  }
  const bytes = randomBytes(length);
  let id = "";
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index] ?? 0;
    id += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
  }
  return id;
}

const PUBLIC_ID_PATTERN = /^[0-9A-Za-z]+$/;

/**
 * Returns true when a candidate string has the opaque base62 public-id shape.
 */
export function isValidPublicId(candidate: string): boolean {
  return candidate.length > 0 && PUBLIC_ID_PATTERN.test(candidate);
}
