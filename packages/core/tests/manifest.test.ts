import { describe, expect, it } from "vitest";
import { ManifestValidationError } from "../src/errors.js";
import { MANIFEST_SCHEMA_VERSION } from "../src/manifest/types.js";
import { parseManifest, serializeManifest } from "../src/manifest/validate.js";

const VALID_MANIFEST = {
  schemaVersion: MANIFEST_SCHEMA_VERSION,
  originAgent: "claude-code",
  originCwd: "/home/dev/pss",
  capturedAt: "2026-06-10T10:00:00.000Z",
  title: "Test",
  turns: [
    { role: "user", text: "hi", toolCalls: [], timestamp: null },
  ],
};

describe("parseManifest - happy paths", () => {
  it("accepts a minimal valid manifest", () => {
    const result = parseManifest(VALID_MANIFEST);
    expect(result.originAgent).toBe("claude-code");
    expect(result.turns).toHaveLength(1);
  });

  it("accepts a future minor version (same major)", () => {
    const future = { ...VALID_MANIFEST, schemaVersion: "1.99.0" };
    expect(() => parseManifest(future)).not.toThrow();
  });

  it("accepts a manifest with a valid nativeSource and one without", () => {
    const withSource = parseManifest({
      ...VALID_MANIFEST,
      nativeSource: { agent: "claude-code", content: '{"type":"user"}' },
    });
    expect(withSource.nativeSource?.agent).toBe("claude-code");
    expect(withSource.nativeSource?.content).toBe('{"type":"user"}');
    expect(parseManifest(VALID_MANIFEST).nativeSource).toBeNull();
  });

  it("accepts null originCwd and title", () => {
    const result = parseManifest({
      ...VALID_MANIFEST,
      originCwd: null,
      title: null,
    });
    expect(result.originCwd).toBeNull();
    expect(result.title).toBeNull();
  });

  it("accepts a turn with toolCalls", () => {
    const result = parseManifest({
      ...VALID_MANIFEST,
      turns: [
        {
          role: "assistant",
          text: null,
          toolCalls: [{ name: "Edit", input: { file: "a.ts" }, result: "ok" }],
          timestamp: null,
        },
      ],
    });
    expect(result.turns[0]?.toolCalls[0]?.name).toBe("Edit");
  });
});

describe("parseManifest - schema version errors", () => {
  it("rejects a different major version", () => {
    const incompatible = { ...VALID_MANIFEST, schemaVersion: "2.0.0" };
    expect(() => parseManifest(incompatible)).toThrow(ManifestValidationError);
    try {
      parseManifest(incompatible);
    } catch (error) {
      expect((error as ManifestValidationError).message).toContain("Unsupported schemaVersion");
    }
  });

  it("rejects a non-string schemaVersion", () => {
    expect(() => parseManifest({ ...VALID_MANIFEST, schemaVersion: 1 })).toThrow(
      ManifestValidationError,
    );
  });
});

describe("parseManifest - field validation errors", () => {
  it("rejects a non-object manifest", () => {
    expect(() => parseManifest("not an object")).toThrow(ManifestValidationError);
    expect(() => parseManifest(null)).toThrow(ManifestValidationError);
    expect(() => parseManifest([])).toThrow(ManifestValidationError);
  });

  it("rejects an unknown originAgent", () => {
    expect(() =>
      parseManifest({ ...VALID_MANIFEST, originAgent: "unknown-bot" }),
    ).toThrow(ManifestValidationError);
  });

  it("rejects a missing turns array", () => {
    const { turns: _turns, ...noTurns } = VALID_MANIFEST;
    expect(() => parseManifest(noTurns)).toThrow(ManifestValidationError);
  });

  it("rejects turns that is not an array", () => {
    expect(() => parseManifest({ ...VALID_MANIFEST, turns: "bad" })).toThrow(
      ManifestValidationError,
    );
  });

  it("rejects a turn with an invalid role", () => {
    expect(() =>
      parseManifest({
        ...VALID_MANIFEST,
        turns: [{ role: "robot", text: "hi", toolCalls: [], timestamp: null }],
      }),
    ).toThrow(ManifestValidationError);
  });

  it("rejects a turn that is not an object", () => {
    expect(() =>
      parseManifest({ ...VALID_MANIFEST, turns: ["string-turn"] }),
    ).toThrow(ManifestValidationError);
  });

  it("rejects a toolCall that is not an object", () => {
    expect(() =>
      parseManifest({
        ...VALID_MANIFEST,
        turns: [{ role: "user", text: "hi", toolCalls: [42], timestamp: null }],
      }),
    ).toThrow(ManifestValidationError);
  });

  it("rejects a nativeSource that is not an object", () => {
    expect(() =>
      parseManifest({ ...VALID_MANIFEST, nativeSource: "raw text" }),
    ).toThrow(ManifestValidationError);
  });

  it("rejects a nativeSource with an unknown agent or missing content", () => {
    expect(() =>
      parseManifest({
        ...VALID_MANIFEST,
        nativeSource: { agent: "vim", content: "x" },
      }),
    ).toThrow(ManifestValidationError);
    expect(() =>
      parseManifest({
        ...VALID_MANIFEST,
        nativeSource: { agent: "claude-code", content: 42 },
      }),
    ).toThrow(ManifestValidationError);
  });
});

describe("serializeManifest", () => {
  it("round-trips through JSON.parse", () => {
    const manifest = parseManifest(VALID_MANIFEST);
    const serialized = serializeManifest(manifest);
    const reparsed = parseManifest(JSON.parse(serialized) as unknown);
    expect(reparsed.originAgent).toBe(manifest.originAgent);
    expect(reparsed.turns).toHaveLength(manifest.turns.length);
  });
});
