import { describe, expect, it } from "vitest";
import { parseReference } from "../src/reference.js";
import { resolveEndpoint, DEFAULT_ENDPOINT } from "../src/config.js";
import { CliError, EXIT_CODE } from "../src/errors.js";

describe("parseReference", () => {
  it("splits a host/owner/repo slug from the public id", () => {
    const ref = parseReference("github.com/arxhive/pss/AbCdEf123456");
    expect(ref.projectSlug).toBe("github.com/arxhive/pss");
    expect(ref.publicId).toBe("AbCdEf123456");
  });

  it("handles a simple slug", () => {
    const ref = parseReference("local-repo/Xyz789");
    expect(ref.projectSlug).toBe("local-repo");
    expect(ref.publicId).toBe("Xyz789");
  });

  it("rejects a reference without a public id", () => {
    expect(() => parseReference("noslash")).toThrow(CliError);
    try {
      parseReference("noslash");
    } catch (error) {
      expect((error as CliError).exitCode).toBe(EXIT_CODE.USAGE_ERROR);
    }
  });

  it("rejects a malformed public id", () => {
    expect(() => parseReference("slug/bad id!")).toThrow(CliError);
  });
});

describe("resolveEndpoint", () => {
  it("prefers the explicit flag", () => {
    expect(resolveEndpoint("http://example.com/")).toBe("http://example.com");
  });

  it("falls back to the default when nothing provided", () => {
    const saved = process.env.PSS_ENDPOINT;
    delete process.env.PSS_ENDPOINT;
    expect(resolveEndpoint(undefined)).toBe(DEFAULT_ENDPOINT);
    if (saved !== undefined) {
      process.env.PSS_ENDPOINT = saved;
    }
  });
});
