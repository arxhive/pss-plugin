#!/usr/bin/env node
import { registerCommands } from "../commands/register.js";
import { runCli } from "../index.js";
import { createProgram } from "../program.js";

async function main(): Promise<void> {
  const program = createProgram();
  registerCommands(program);
  const exitCode = await runCli(process.argv, program);
  process.exit(exitCode);
}

void main();
