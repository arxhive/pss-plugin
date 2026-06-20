import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { opencodeAdapter } from "../../src/adapters/opencode.js";
import { parseManifest } from "../../src/manifest/validate.js";

const fixture = readFileSync(
  join(__dirname, "..", "fixtures", "opencode.json"),
  "utf-8",
);

describe("opencodeAdapter", () => {
  it("declares native resume support", () => {
    expect(opencodeAdapter.supportsNativeResume).toBe(true);
    expect(opencodeAdapter.id).toBe("opencode");
  });

  it("imports the session/message/part tree into a manifest", () => {
    const manifest = opencodeAdapter.import(fixture, "/home/dev/pss");
    expect(() => parseManifest(manifest)).not.toThrow();
    expect(manifest.title).toBe("Investigate flaky test");
    expect(manifest.turns).toHaveLength(2);
    expect(manifest.turns[0]?.text).toContain("flaky");
    expect(manifest.turns[1]?.toolCalls[0]?.name).toBe("bash");
    expect(manifest.turns[1]?.toolCalls[0]?.result).toBe("1 failing");
  });

  it("round-trips native -> neutral -> native rebuilding the tree", () => {
    const manifest = opencodeAdapter.import(fixture, "/home/dev/pss");
    const instruction = opencodeAdapter.export(manifest, {
      targetCwd: "/home/dev/pss",
      nativeSessionId: "ses_new",
    });
    expect(instruction.mode).toBe("native-resume");
    expect(instruction.openCommand).toBe("opencode -c");
    const sessionArtifact = instruction.artifacts.find((artifact) =>
      artifact.path.includes("session"),
    );
    expect(sessionArtifact?.path).toContain("ses_new.json");
    const partArtifacts = instruction.artifacts.filter((artifact) =>
      artifact.path.includes(join("part", "")),
    );
    expect(partArtifacts.length).toBeGreaterThanOrEqual(3);
  });
});
