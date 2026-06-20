/**
 * CLI endpoint/config resolution (contracts/cli.md). Precedence: explicit
 * --endpoint flag, then PSS_ENDPOINT env var, then the default localhost URL.
 */

export const DEFAULT_ENDPOINT = "http://localhost:3000";

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
