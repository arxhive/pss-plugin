import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearToken,
  readStoredToken,
  resolveToken,
  storeToken,
} from "../src/config.js";
import { ApiClient } from "../src/apiClient.js";
import { CliError, EXIT_CODE } from "../src/errors.js";

const ENV_KEYS = ["XDG_CONFIG_HOME", "HOME", "PSS_TOKEN"] as const;

describe("token storage and resolution", () => {
  let tempDir: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pss-auth-"));
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    process.env.XDG_CONFIG_HOME = tempDir;
    process.env.HOME = tempDir;
    delete process.env.PSS_TOKEN;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("round-trips storeToken/readStoredToken/clearToken", () => {
    expect(readStoredToken()).toBeUndefined();
    storeToken("tok-abc");
    expect(readStoredToken()).toBe("tok-abc");
    clearToken();
    expect(readStoredToken()).toBeUndefined();
  });

  it("writes the config file with owner-only permissions", () => {
    storeToken("tok-secure");
    const path = join(tempDir, "pss", "config.json");
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("tolerates a corrupt config file", () => {
    storeToken("tok-good");
    const path = join(tempDir, "pss", "config.json");
    writeFileSync(path, "{ not json", "utf-8");
    expect(readStoredToken()).toBeUndefined();
  });

  it("logout is idempotent when no token is stored", () => {
    expect(() => clearToken()).not.toThrow();
  });

  it("prefers the flag over env and stored token", () => {
    process.env.PSS_TOKEN = "from-env";
    storeToken("from-file");
    expect(resolveToken("from-flag")).toBe("from-flag");
  });

  it("falls back to PSS_TOKEN when no flag is given", () => {
    process.env.PSS_TOKEN = "from-env";
    storeToken("from-file");
    expect(resolveToken()).toBe("from-env");
  });

  it("falls back to the stored token when no flag or env", () => {
    storeToken("from-file");
    expect(resolveToken()).toBe("from-file");
  });

  it("returns undefined when nothing resolves", () => {
    expect(resolveToken()).toBeUndefined();
    expect(resolveToken("   ")).toBeUndefined();
  });
});

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiClient authorization header", () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];
    const fetchStub = vi.fn(
      (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        calls.push({ url: String(input), init });
        return Promise.resolve(jsonResponse(200, { id: "u1", name: "octocat", email: null }));
      },
    );
    vi.stubGlobal("fetch", fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function authHeader(init: RequestInit | undefined): string | undefined {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    return headers.authorization;
  }

  it("sends a Bearer header when a token is configured", async () => {
    const client = new ApiClient("http://localhost:3000", "tok-xyz");
    await client.getMe();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://localhost:3000/api/me");
    expect(authHeader(calls[0]?.init)).toBe("Bearer tok-xyz");
  });

  it("omits the Authorization header when no token is configured", async () => {
    const client = new ApiClient("http://localhost:3000");
    await client.listProjects();
    expect(authHeader(calls[0]?.init)).toBeUndefined();
  });
});

describe("ApiClient status-to-exit mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function exitCodeForStatus(status: number): Promise<number> {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(status, { error: "denied" }))),
    );
    const client = new ApiClient("http://localhost:3000", "tok");
    try {
      await client.getMe();
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      return (error as CliError).exitCode;
    }
    throw new Error("expected getMe to throw");
  }

  it("maps 401 to NOT_AUTHENTICATED (6)", async () => {
    expect(await exitCodeForStatus(401)).toBe(EXIT_CODE.NOT_AUTHENTICATED);
  });

  it("maps 403 to FORBIDDEN (7)", async () => {
    expect(await exitCodeForStatus(403)).toBe(EXIT_CODE.FORBIDDEN);
  });

  it("maps 404 to NOT_FOUND (3)", async () => {
    expect(await exitCodeForStatus(404)).toBe(EXIT_CODE.NOT_FOUND);
  });
});
