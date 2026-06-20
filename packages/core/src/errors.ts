/**
 * Domain error types for the core package. Boundaries (CLI, API) catch these to
 * produce clear user-facing messages and exit codes / HTTP status codes.
 */

export class ManifestValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

export class UnsupportedAgentError extends Error {
  public readonly supportedAgents: readonly string[];

  public constructor(agent: string, supportedAgents: readonly string[]) {
    super(
      `Unknown agent "${agent}". Supported agents: ${supportedAgents.join(", ")}.`,
    );
    this.name = "UnsupportedAgentError";
    this.supportedAgents = supportedAgents;
  }
}

export class AdapterImportError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AdapterImportError";
  }
}
