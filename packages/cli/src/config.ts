import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * CLI endpoint/config resolution (contracts/cli.md). Precedence: explicit
 * --endpoint flag, then PSS_ENDPOINT env var, then the default hosted portal at
 * pss.cat. Token resolution follows: --token flag, then PSS_TOKEN env var, then
 * the token stored by `pss auth login` in the CLI config file.
 */

export const DEFAULT_ENDPOINT = "https://pss.cat";

interface StoredConfig {
  readonly token?: string;
}

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim().length > 0 ? xdg.trim() : join(homedir(), ".config");
  return join(base, "pss");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

/**
 * Reads the stored token, tolerating a missing or corrupt config file by
 * treating it as no token (never crashes the CLI on a bad file).
 */
export function readStoredToken(): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(configPath(), "utf-8");
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as StoredConfig;
    const token = typeof parsed.token === "string" ? parsed.token.trim() : "";
    return token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

export function storeToken(token: string): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  const body: StoredConfig = { token };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
}

export function clearToken(): void {
  try {
    rmSync(configPath());
  } catch {
    // No stored token to remove is not an error (logout is idempotent).
  }
}

/**
 * Resolves the Bearer token using the contract precedence: explicit flag, then
 * PSS_TOKEN env var, then the stored login token. Empty/whitespace values are
 * treated as absent.
 */
export function resolveToken(flagToken?: string): string | undefined {
  if (flagToken && flagToken.trim().length > 0) {
    return flagToken.trim();
  }
  const fromEnv = process.env.PSS_TOKEN;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return readStoredToken();
}

export interface ResolvedCliConfig {
  readonly endpoint: string;
  readonly json: boolean;
}

export function resolveEndpoint(flagEndpoint?: string): string {
  if (flagEndpoint && flagEndpoint.trim().length > 0) {
    return flagEndpoint.trim().replace(/\/+$/, "");
  }
  const fromEnv = process.env.PSS_ENDPOINT;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return DEFAULT_ENDPOINT;
}
