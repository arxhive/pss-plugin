import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codexAdapter } from "../../src/adapters/codex.js";
import { parseManifest } from "../../src/manifest/validate.js";

const fixture = readFileSync(
  join(__dirname, "..", "fixtures", "codex.jsonl"),
  "utf-8",
);

describe("codexAdapter", () => {
  it("declares native resume support", () => {
    expect(codexAdapter.supportsNativeResume).toBe(true);
    expect(codexAdapter.id).toBe("codex");
  });

  it("imports rollout JSONL into a valid manifest with tool calls", () => {
    const manifest = codexAdapter.import(fixture, "/home/dev/pss");
    expect(() => parseManifest(manifest)).not.toThrow();
    expect(manifest.turns).toHaveLength(3);
    expect(manifest.turns[0]?.text).toContain("Refactor the parser");
    const toolTurn = manifest.turns.find((turn) => turn.toolCalls.length > 0);
    expect(toolTurn?.toolCalls[0]?.name).toBe("apply_patch");
    expect(toolTurn?.toolCalls[0]?.result).toBe("ok");
  });

  it("round-trips native -> neutral -> native preserving messages and tools", () => {
    const manifest = codexAdapter.import(fixture, "/home/dev/pss");
    const instruction = codexAdapter.export(manifest, {
      targetCwd: "/home/dev/pss",
      nativeSessionId: "run-42",
    });
    expect(instruction.mode).toBe("native-resume");
    expect(instruction.openCommand).toBe("codex resume run-42");
    expect(instruction.artifacts[0]?.path).toContain("rollout-run-42.jsonl");
    const reimported = codexAdapter.import(
      instruction.artifacts[0]?.content ?? "",
      "/home/dev/pss",
    );
    expect(reimported.turns.filter((turn) => turn.text !== null).map((turn) => turn.text)).toEqual([
      "Refactor the parser",
      "Refactoring now.",
    ]);
    const reTool = reimported.turns.find((turn) => turn.toolCalls.length > 0);
    expect(reTool?.toolCalls[0]?.name).toBe("apply_patch");
  });
});
