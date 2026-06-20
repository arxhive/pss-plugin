import type { Command } from "commander";
import "@pss/core";
import { registerPush } from "./push.js";
import { registerClone } from "./clone.js";
import { registerManageCommands } from "./manage.js";
import { registerFork } from "./fork.js";

/**
 * Central registration point for all CLI verbs. Importing @pss/core also
 * self-registers the agent adapters into the shared registry.
 */
export function registerCommands(program: Command): void {
  registerPush(program);
  registerClone(program);
  registerManageCommands(program);
  registerFork(program);
}
