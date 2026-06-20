import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cursorAdapter } from "../../src/adapters/cursor.js";
import { parseManifest } from "../../src/manifest/validate.js";

const fixture = readFileSync(
  join(__dirname, "..", "fixtures", "cursor.json"),
  "utf-8",
);

describe("cursorAdapter", () => {
  it("does NOT claim native resume support (FR-015)", () => {
    expect(cursorAdapter.supportsNativeResume).toBe(false);
    expect(cursorAdapter.id).toBe("cursor");
  });

  it("imports an exported transcript into a manifest", () => {
    const manifest = cursorAdapter.import(fixture, "/home/dev/pss");
    expect(() => parseManifest(manifest)).not.toThrow();
    expect(manifest.title).toBe("Design the auth flow");
    expect(manifest.turns).toHaveLength(2);
    expect(manifest.turns[0]?.role).toBe("user");
  });

  it("exports a handoff.md bootstrap prompt with mode handoff", () => {
    const manifest = cursorAdapter.import(fixture, "/home/dev/pss");
    const instruction = cursorAdapter.export(manifest, {
      targetCwd: "/home/dev/pss",
      nativeSessionId: "ignored",
    });
    expect(instruction.mode).toBe("handoff");
    expect(instruction.artifacts).toHaveLength(1);
    expect(instruction.artifacts[0]?.path).toBe("/home/dev/pss/handoff.md");
    expect(instruction.openCommand).toContain("/home/dev/pss/handoff.md");
    expect(instruction.artifacts[0]?.content).toContain("Session handoff");
    expect(instruction.artifacts[0]?.content).toContain("Sketch a login flow");
    expect(instruction.notes.toLowerCase()).toContain("no supported way");
  });
});
