import { Command } from "commander";
import { CliError, EXIT_CODE } from "../errors.js";
import { logAction, logFailure, logInput, logSuccess } from "../logger.js";
import { emit } from "../output.js";
import { parseReference } from "../reference.js";
import { buildContext, globalOptionsFrom, type CliContext } from "../program.js";

/**
 * Session management verbs (T046, FR-029): list, rename, visibility, archive,
 * rm. Each logs input/action/outcome and maps failures to CLI exit codes.
 */

async function withContext(
  command: Command,
  name: string,
  run: (ctx: CliContext) => Promise<void>,
): Promise<void> {
  const ctx = buildContext(globalOptionsFrom(command));
  try {
    await run(ctx);
  } catch (error) {
    if (error instanceof CliError) {
      logFailure(name, error.message);
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logFailure(name, message);
    throw new CliError(message, EXIT_CODE.GENERIC_FAILURE);
  }
}

function registerList(program: Command): void {
  program
    .command("list")
    .description("List projects, or sessions within a project")
    .argument("[project-slug]", "Project slug to list sessions for")
    .option("--archived", "Include archived sessions")
    .action(async (slug: string | undefined, options: { archived?: boolean }, command: Command) => {
      await withContext(command, "list", async (ctx) => {
        logInput("list", { slug: slug ?? null, archived: options.archived ?? false });
        if (!slug) {
          const projects = await ctx.api.listProjects();
          emit(ctx.json, projects, projects.map((p) => `${p.slug} (${p.sessionCount ?? 0})`));
          logSuccess("list", { count: projects.length });
          return;
        }
        const sessions = await ctx.api.listSessions(slug, options.archived ?? false);
        emit(
          ctx.json,
          sessions,
          sessions.map((s) => `${slug}/${s.publicId}  ${s.name}  [${s.originAgent}, ${s.visibility}${s.archived ? ", archived" : ""}]`),
        );
        logSuccess("list", { slug, count: sessions.length });
      });
    });
}

function registerRename(program: Command): void {
  program
    .command("rename")
    .description("Rename a session")
    .argument("<reference>", "Session reference <project-slug>/<public-id>")
    .argument("<new-name>", "New session name")
    .action(async (reference: string, newName: string, _options: unknown, command: Command) => {
      await withContext(command, "rename", async (ctx) => {
        const { publicId } = parseReference(reference);
        logAction("rename", { reference, newName });
        const session = await ctx.api.updateSession(publicId, { name: newName });
        emit(ctx.json, session, [`Renamed to "${session.name}"`]);
        logSuccess("rename", { publicId });
      });
    });
}

function registerVisibility(program: Command): void {
  program
    .command("visibility")
    .description("Set session visibility")
    .argument("<reference>", "Session reference <project-slug>/<public-id>")
    .argument("<value>", "private or public")
    .action(async (reference: string, value: string, _options: unknown, command: Command) => {
      await withContext(command, "visibility", async (ctx) => {
        if (value !== "private" && value !== "public") {
          throw new CliError("visibility must be private or public", EXIT_CODE.USAGE_ERROR);
        }
        const { publicId } = parseReference(reference);
        logAction("visibility", { reference, value });
        const session = await ctx.api.updateSession(publicId, { visibility: value });
        emit(ctx.json, session, [`Visibility is now ${session.visibility}`]);
        logSuccess("visibility", { publicId });
      });
    });
}

function registerArchive(program: Command): void {
  program
    .command("archive")
    .description("Archive a session")
    .argument("<reference>", "Session reference <project-slug>/<public-id>")
    .action(async (reference: string, _options: unknown, command: Command) => {
      await withContext(command, "archive", async (ctx) => {
        const { publicId } = parseReference(reference);
        logAction("archive", { reference });
        const session = await ctx.api.updateSession(publicId, { archived: true });
        emit(ctx.json, session, [`Archived ${reference}`]);
        logSuccess("archive", { publicId });
      });
    });
}

function registerRm(program: Command): void {
  program
    .command("rm")
    .description("Delete a session, or a project with --project --confirm")
    .argument("<reference>", "Session reference or project slug")
    .option("--project", "Treat the reference as a project slug for cascade delete")
    .option("--confirm", "Confirm a project cascade delete")
    .action(
      async (
        reference: string,
        options: { project?: boolean; confirm?: boolean },
        command: Command,
      ) => {
        await withContext(command, "rm", async (ctx) => {
          logInput("rm", { reference, project: options.project ?? false });
          if (options.project) {
            if (!options.confirm) {
              throw new CliError("Project deletion requires --confirm", EXIT_CODE.USAGE_ERROR);
            }
            await ctx.api.deleteProject(reference);
            emit(ctx.json, { deleted: reference }, [`Deleted project ${reference} and all its sessions`]);
            logSuccess("rm", { project: reference });
            return;
          }
          const { publicId } = parseReference(reference);
          await ctx.api.deleteSession(publicId);
          emit(ctx.json, { deleted: reference }, [`Deleted session ${reference}`]);
          logSuccess("rm", { publicId });
        });
      },
    );
}

export function registerManageCommands(program: Command): void {
  registerList(program);
  registerRename(program);
  registerVisibility(program);
  registerArchive(program);
  registerRm(program);
}
