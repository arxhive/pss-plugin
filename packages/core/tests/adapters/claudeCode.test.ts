import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  claudeCodeAdapter,
  encodeClaudeCwd,
} from "../../src/adapters/claudeCode.js";
import { parseManifest } from "../../src/manifest/validate.js";

const fixture = readFileSync(
  join(__dirname, "..", "fixtures", "claudeCode.jsonl"),
  "utf-8",
);

describe("claudeCodeAdapter", () => {
  it("declares native resume support", () => {
    expect(claudeCodeAdapter.supportsNativeResume).toBe(true);
    expect(claudeCodeAdapter.id).toBe("claude-code");
  });

  it("imports JSONL into a valid neutral manifest", () => {
    const manifest = claudeCodeAdapter.import(fixture, "/home/dev/pss");
    expect(() => parseManifest(manifest)).not.toThrow();
    expect(manifest.originAgent).toBe("claude-code");
    expect(manifest.turns).toHaveLength(3);
    expect(manifest.turns[0]?.role).toBe("user");
    expect(manifest.turns[0]?.text).toContain("health check");
    expect(manifest.turns[1]?.toolCalls[0]?.name).toBe("Edit");
  });

  it("rewrites the captured native transcript byte-faithfully under a new id", () => {
    const manifest = {
      ...claudeCodeAdapter.import(fixture, "/home/dev/pss"),
      nativeSource: { agent: "claude-code" as const, content: fixture },
    };
    const instruction = claudeCodeAdapter.export(manifest, {
      targetCwd: "/home/other/checkout",
      nativeSessionId: "sess-xyz",
    });
    expect(instruction.mode).toBe("native-resume");
    expect(instruction.openCommand).toBe("claude --resume sess-xyz");
    const lines = (instruction.artifacts[0]?.content ?? "")
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.sessionId).toBe("sess-xyz");
      expect(line.cwd).toBe("/home/other/checkout");
      expect(line.version).toBe("2.1.0");
    }
    const assistantContent = (lines[1]?.message as { content: unknown[] }).content;
    expect(assistantContent[1]).toEqual({
      type: "tool_use",
      name: "Edit",
      input: { file: "server.ts" },
    });
  });

  it("synthesizes a fully enveloped text-only transcript without a native source", () => {
    const manifest = claudeCodeAdapter.import(fixture, "/home/dev/pss");
    const instruction = claudeCodeAdapter.export(manifest, {
      targetCwd: "/home/dev/pss",
      nativeSessionId: "sess-xyz",
    });
    const lines = (instruction.artifacts[0]?.content ?? "")
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(3);
    let previousUuid: unknown = null;
    for (const line of lines) {
      expect(line.sessionId).toBe("sess-xyz");
      expect(line.cwd).toBe("/home/dev/pss");
      expect(line.parentUuid).toBe(previousUuid);
      expect(line.userType).toBe("external");
      expect(line.isSidechain).toBe(false);
      previousUuid = line.uuid;
    }
    const assistantContent = (lines[1]?.message as { content: { type: string; text: string }[] })
      .content;
    expect(assistantContent).toHaveLength(1);
    expect(assistantContent[0]?.type).toBe("text");
    expect(assistantContent[0]?.text).toContain("[tool Edit input:");
  });

  it("places the artifact under the encoded-cwd projects directory", () => {
    const manifest = claudeCodeAdapter.import(fixture, "/home/dev/pss");
    const instruction = claudeCodeAdapter.export(manifest, {
      targetCwd: "/home/dev/pss",
      nativeSessionId: "sess-xyz",
    });
    expect(instruction.artifacts[0]?.path).toContain(
      encodeClaudeCwd("/home/dev/pss"),
    );
    expect(instruction.artifacts[0]?.path).toContain("sess-xyz.jsonl");
  });
});
