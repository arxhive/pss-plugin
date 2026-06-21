import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { ApiClient, type IdentityDto } from "../apiClient.js";
import { resolveEndpoint, resolveToken, storeToken, clearToken } from "../config.js";
import { CliError, EXIT_CODE } from "../errors.js";
import { logAction, logFailure, logInput, logSuccess } from "../logger.js";
import { emit } from "../output.js";
import { globalOptionsFrom, type GlobalOptions } from "../program.js";

const COMMAND = "auth";

interface LoginOptions {
  token?: string;
}

function identityLabel(identity: IdentityDto): string {
  return identity.name ?? identity.email ?? identity.id;
}

/**
 * Reads a single line from stdin, prompting the user to paste a token. Fails with
 * a usage error when stdin is not a TTY and no token was supplied via --token.
 */
async function promptForToken(): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new CliError(
      "No token provided. Pass --token <value> when stdin is not interactive.",
      EXIT_CODE.USAGE_ERROR,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question("Paste your portal token: ");
    const token = answer.trim();
    if (token.length === 0) {
      throw new CliError("No token entered.", EXIT_CODE.USAGE_ERROR);
    }
    return token;
  } finally {
    rl.close();
  }
}

async function runLogin(options: LoginOptions, command: Command): Promise<void> {
  const global = globalOptionsFrom(command);
  const endpoint = resolveEndpoint(global.endpoint);
  logInput(COMMAND, { action: "login", source: options.token ? "flag" : "env-or-prompt" });
  const candidate = resolveToken(options.token) ?? (await promptForToken());
  logAction(COMMAND, { action: "login", validating: true });
  const identity = await new ApiClient(endpoint, candidate).getMe();
  storeToken(candidate);
  logSuccess(COMMAND, { action: "login", userId: identity.id });
  emit(global.json ?? false, { authenticated: true, identity }, [
    `Logged in as ${identityLabel(identity)}`,
  ]);
}

async function runStatus(command: Command): Promise<void> {
  const global = globalOptionsFrom(command);
  const endpoint = resolveEndpoint(global.endpoint);
  const token = resolveToken();
  logInput(COMMAND, { action: "status", authenticated: token !== undefined });
  if (token === undefined) {
    logFailure(COMMAND, "not authenticated", { action: "status" });
    emit(global.json ?? false, { authenticated: false }, ["not authenticated"]);
    throw new CliError("Not authenticated.", EXIT_CODE.NOT_AUTHENTICATED);
  }
  let identity: IdentityDto;
  try {
    identity = await new ApiClient(endpoint, token).getMe();
  } catch (error) {
    if (error instanceof CliError && error.exitCode === EXIT_CODE.NOT_AUTHENTICATED) {
      logFailure(COMMAND, "stored token is no longer valid", { action: "status" });
      emit(global.json ?? false, { authenticated: false }, [
        "stored token is no longer valid",
      ]);
      throw new CliError("Stored token is no longer valid.", EXIT_CODE.NOT_AUTHENTICATED);
    }
    throw error;
  }
  logSuccess(COMMAND, { action: "status", userId: identity.id });
  emit(global.json ?? false, { authenticated: true, identity }, [
    `Authenticated as ${identityLabel(identity)}`,
  ]);
}

function runLogout(command: Command): void {
  const global = globalOptionsFrom(command);
  logInput(COMMAND, { action: "logout" });
  clearToken();
  logSuccess(COMMAND, { action: "logout" });
  emit(global.json ?? false, { authenticated: false }, ["Logged out."]);
}

function reportFailure(error: unknown): never {
  if (error instanceof CliError) {
    if (error.exitCode === EXIT_CODE.NOT_AUTHENTICATED) {
      logFailure(COMMAND, "token rejected");
    } else {
      logFailure(COMMAND, error.message);
    }
    throw error;
  }
  const message = error instanceof Error ? error.message : String(error);
  logFailure(COMMAND, message);
  throw new CliError(message, EXIT_CODE.GENERIC_FAILURE);
}

function registerLogin(auth: Command): void {
  auth
    .command("login")
    .description("Store a portal-issued token for authenticated operations")
    .option("--token <value>", "Token to store (otherwise read from PSS_TOKEN or prompt)")
    .action(async (options: LoginOptions, command: Command) => {
      try {
        await runLogin(options, command);
      } catch (error) {
        reportFailure(error);
      }
    });
}

function registerStatus(auth: Command): void {
  auth
    .command("status")
    .description("Show the current authentication state")
    .action(async (_options: GlobalOptions, command: Command) => {
      try {
        await runStatus(command);
      } catch (error) {
        reportFailure(error);
      }
    });
}

function registerLogout(auth: Command): void {
  auth
    .command("logout")
    .description("Remove the locally stored token")
    .action((_options: GlobalOptions, command: Command) => {
      try {
        runLogout(command);
      } catch (error) {
        reportFailure(error);
      }
    });
}

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Manage portal authentication");
  registerLogin(auth);
  registerStatus(auth);
  registerLogout(auth);
}
