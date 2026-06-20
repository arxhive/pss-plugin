import { describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../../src/adapters/claudeCode.js";
import { codexAdapter } from "../../src/adapters/codex.js";
import { cursorAdapter } from "../../src/adapters/cursor.js";
import { opencodeAdapter } from "../../src/adapters/opencode.js";
import { AdapterImportError } from "../../src/errors.js";

/**
 * Tests that each adapter throws AdapterImportError on malformed native input.
 * This validates the explicit-error contract (FR-016 safety net) so callers
 * never silently produce broken manifests from bad source data.
 */

describe("claudeCodeAdapter.import - error paths", () => {
  it("throws AdapterImportError on invalid JSONL", () => {
    expect(() => claudeCodeAdapter.import("not { valid json }\n{}", null)).toThrow(
      AdapterImportError,
    );
  });

  it("returns an empty-turn manifest for JSONL with no recognizable records", () => {
    const manifest = claudeCodeAdapter.import('{"type":"metadata","version":1}', null);
    expect(manifest.turns).toHaveLength(0);
    expect(manifest.originAgent).toBe("claude-code");
  });
});

describe("codexAdapter.import - error paths", () => {
  it("throws AdapterImportError on invalid JSONL", () => {
    expect(() => codexAdapter.import("{bad json", null)).toThrow(AdapterImportError);
  });

  it("returns an empty-turn manifest for JSONL with no text content", () => {
    const manifest = codexAdapter.import('{"type":"system_event","action":"start"}', null);
    expect(manifest.turns).toHaveLength(0);
  });
});

describe("cursorAdapter.import - error paths", () => {
  it("throws AdapterImportError on invalid JSON", () => {
    expect(() => cursorAdapter.import("not json at all", null)).toThrow(
      AdapterImportError,
    );
  });

  it("returns an empty-turn manifest for a transcript with no messages", () => {
    const manifest = cursorAdapter.import(JSON.stringify({ title: "Empty" }), null);
    expect(manifest.turns).toHaveLength(0);
    expect(manifest.title).toBe("Empty");
  });
});

describe("opencodeAdapter.import - error paths", () => {
  it("throws AdapterImportError on invalid JSON", () => {
    expect(() => opencodeAdapter.import("{broken", null)).toThrow(AdapterImportError);
  });

  it("returns an empty-turn manifest for a tree with no messages", () => {
    const emptyTree = JSON.stringify({ session: { id: "s1", title: "No msgs" }, messages: [] });
    const manifest = opencodeAdapter.import(emptyTree, null);
    expect(manifest.turns).toHaveLength(0);
    expect(manifest.title).toBe("No msgs");
  });
});
