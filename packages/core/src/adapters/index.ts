import { registerAdapter } from "./registry.js";
import { claudeCodeAdapter } from "./claudeCode.js";
import { codexAdapter } from "./codex.js";
import { cursorAdapter } from "./cursor.js";
import { opencodeAdapter } from "./opencode.js";

/**
 * Registers the four supported agent adapters (FR-016). Importing this module
 * self-registers them so getAdapter() resolves in both the CLI and the web API.
 */
registerAdapter(claudeCodeAdapter);
registerAdapter(codexAdapter);
registerAdapter(cursorAdapter);
registerAdapter(opencodeAdapter);

export { claudeCodeAdapter } from "./claudeCode.js";
export { codexAdapter } from "./codex.js";
export { cursorAdapter } from "./cursor.js";
export { opencodeAdapter } from "./opencode.js";
