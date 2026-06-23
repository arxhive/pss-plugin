import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  claudeCodeAdapter,
  encodeClaudeCwd,
  trimCaptureCommand,
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

describe("trimCaptureCommand", () => {
  const PSS_COMMAND =
    "<command-message>pss</command-message>\n<command-name>/pss</command-name>";

  function userLine(text: string): string {
    return JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
    });
  }

  function commandLine(content: string): string {
    return JSON.stringify({ type: "user", message: { role: "user", content } });
  }

  function assistantLine(text: string): string {
    return JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text }] },
    });
  }

  function nonEmpty(source: string): string[] {
    return source.split("\n").filter((line) => line.length > 0);
  }

  it("drops the capture command and every record after it", () => {
    const source = [
      userLine("Add a health check endpoint"),
      assistantLine("Done."),
      commandLine(PSS_COMMAND),
      userLine("Base directory for this skill: /Users/d1/.claude/skills/pss"),
      assistantLine("[tool Bash input: pss push]"),
    ].join("\n");

    const trimmed = trimCaptureCommand(source);

    expect(nonEmpty(trimmed)).toHaveLength(2);
    expect(trimmed).not.toContain("command-name");
    expect(trimmed).not.toContain("Base directory for this skill");

    const manifest = claudeCodeAdapter.import(trimmed, "/home/dev/pss");
    expect(manifest.turns).toHaveLength(2);
    expect(manifest.turns[1]?.text).toBe("Done.");
  });

  it("returns the transcript unchanged when no capture command is present", () => {
    expect(trimCaptureCommand(fixture)).toBe(fixture);
  });

  it("cuts at the newest invocation, keeping earlier work and a prior run", () => {
    const source = [
      userLine("first task"),
      commandLine(PSS_COMMAND),
      userLine("more work after the first share"),
      commandLine(PSS_COMMAND),
      userLine("Base directory for this skill"),
    ].join("\n");

    const trimmed = trimCaptureCommand(source);
    const lines = nonEmpty(trimmed);

    expect(lines).toHaveLength(3);
    expect(lines.filter((line) => line.includes("command-name"))).toHaveLength(1);
    expect(trimmed).toContain("more work after the first share");
  });

  it("matches the plugin-namespaced command form", () => {
    const source = [
      userLine("scoped task"),
      commandLine("<command-name>/pss:pss</command-name>"),
      userLine("skill body"),
    ].join("\n");

    const trimmed = trimCaptureCommand(source);

    expect(nonEmpty(trimmed)).toHaveLength(1);
    expect(trimmed).toContain("scoped task");
  });

  it("does not match an unrelated command that merely starts with pss", () => {
    const source = [
      userLine("unrelated task"),
      commandLine("<command-name>/pss-export</command-name>"),
    ].join("\n");

    expect(trimCaptureCommand(source)).toBe(source);
  });
});
