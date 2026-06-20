import type {
  AgentId,
  CloneInstruction,
  SessionManifest,
} from "@pss/core";
import { CliError, EXIT_CODE } from "./errors.js";

/**
 * HTTP client for the PSS REST API. Maps HTTP status codes to typed CliErrors
 * with the correct exit codes (contracts/cli.md exit-code table). Uses the
 * global fetch available on Node 20+.
 */

export interface ProjectDto {
  readonly slug: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly sessionCount?: number;
}

export interface SessionDto {
  readonly publicId: string;
  readonly projectSlug: string;
  readonly name: string;
  readonly originAgent: AgentId;
  readonly visibility: "private" | "public";
  readonly archived: boolean;
  readonly parentPublicId: string | null;
  readonly payloadBytes: number;
  readonly createdAt: string;
}

export interface SessionRefDto {
  readonly publicId: string;
  readonly projectSlug: string;
  readonly url: string;
}

export interface PushSessionBody {
  readonly name: string;
  readonly originAgent: AgentId;
  readonly projectSlug?: string;
  readonly derivedSlug?: string;
  readonly visibility: "private" | "public";
  readonly manifest: SessionManifest;
}

function apiUrl(endpoint: string, path: string): string {
  return `${endpoint}/api${path}`;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; detail?: string };
    return body.detail ? `${body.error}: ${body.detail}` : (body.error ?? response.statusText);
  } catch {
    return response.statusText;
  }
}

function mapStatusToExit(status: number): CliError["exitCode"] {
  if (status === 404) {
    return EXIT_CODE.NOT_FOUND;
  }
  if (status === 413) {
    return EXIT_CODE.PAYLOAD_TOO_LARGE;
  }
  if (status === 400) {
    return EXIT_CODE.USAGE_ERROR;
  }
  return EXIT_CODE.GENERIC_FAILURE;
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const message = await parseError(response);
  throw new CliError(message, mapStatusToExit(response.status));
}

export class ApiClient {
  private readonly endpoint: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  public async pushSession(body: PushSessionBody): Promise<SessionRefDto> {
    const response = await fetch(apiUrl(this.endpoint, "/sessions"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await ensureOk(response);
    return (await response.json()) as SessionRefDto;
  }

  public async getPayload(publicId: string): Promise<SessionManifest> {
    const response = await fetch(
      apiUrl(this.endpoint, `/sessions/${encodeURIComponent(publicId)}/payload`),
    );
    await ensureOk(response);
    return (await response.json()) as SessionManifest;
  }

  public async clone(publicId: string, agent: AgentId): Promise<CloneInstruction> {
    const response = await fetch(
      apiUrl(
        this.endpoint,
        `/sessions/${encodeURIComponent(publicId)}/clone?agent=${encodeURIComponent(agent)}`,
      ),
    );
    await ensureOk(response);
    return (await response.json()) as CloneInstruction;
  }

  public async listProjects(): Promise<ProjectDto[]> {
    const response = await fetch(apiUrl(this.endpoint, "/projects"));
    await ensureOk(response);
    return (await response.json()) as ProjectDto[];
  }

  public async listSessions(
    slug: string,
    includeArchived: boolean,
  ): Promise<SessionDto[]> {
    const query = includeArchived ? "?archived=true" : "";
    const response = await fetch(
      apiUrl(this.endpoint, `/projects/${encodeURIComponent(slug)}/sessions${query}`),
    );
    await ensureOk(response);
    return (await response.json()) as SessionDto[];
  }

  public async updateSession(
    publicId: string,
    update: { name?: string; visibility?: "private" | "public"; archived?: boolean },
  ): Promise<SessionDto> {
    const response = await fetch(
      apiUrl(this.endpoint, `/sessions/${encodeURIComponent(publicId)}`),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      },
    );
    await ensureOk(response);
    return (await response.json()) as SessionDto;
  }

  public async deleteSession(publicId: string): Promise<void> {
    const response = await fetch(
      apiUrl(this.endpoint, `/sessions/${encodeURIComponent(publicId)}`),
      { method: "DELETE" },
    );
    await ensureOk(response);
  }

  public async deleteProject(slug: string): Promise<void> {
    const response = await fetch(
      apiUrl(this.endpoint, `/projects/${encodeURIComponent(slug)}?confirm=true`),
      { method: "DELETE" },
    );
    await ensureOk(response);
  }

  public async forkSession(publicId: string, name?: string): Promise<SessionRefDto> {
    const response = await fetch(
      apiUrl(this.endpoint, `/sessions/${encodeURIComponent(publicId)}/forks`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(name ? { name } : {}),
      },
    );
    await ensureOk(response);
    return (await response.json()) as SessionRefDto;
  }
}
