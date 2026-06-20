import { describe, expect, it } from "vitest";
import {
  deriveProjectSlug,
  deriveSlugFromDirectory,
  deriveSlugFromGitRemote,
} from "../src/identity/slug.js";
import {
  PUBLIC_ID_LENGTH,
  generatePublicId,
  isValidPublicId,
} from "../src/identity/publicId.js";

describe("deriveSlugFromGitRemote", () => {
  it("parses an HTTPS github remote into host/owner/repo", () => {
    expect(deriveSlugFromGitRemote("https://github.com/arxhive/pss.git")).toBe(
      "github.com/arxhive/pss",
    );
  });

  it("parses an SSH github remote into host/owner/repo", () => {
    expect(deriveSlugFromGitRemote("git@github.com:arxhive/pss.git")).toBe(
      "github.com/arxhive/pss",
    );
  });

  it("lowercases and strips the .git suffix", () => {
    expect(deriveSlugFromGitRemote("https://GitHub.com/Arx/PSS")).toBe(
      "github.com/arx/pss",
    );
  });

  it("supports nested gitlab subgroups", () => {
    expect(
      deriveSlugFromGitRemote("https://gitlab.com/group/sub/repo.git"),
    ).toBe("gitlab.com/group/sub/repo");
  });

  it("returns null for an unparseable remote", () => {
    expect(deriveSlugFromGitRemote("not a url")).toBeNull();
    expect(deriveSlugFromGitRemote("")).toBeNull();
  });
});

describe("deriveSlugFromDirectory", () => {
  it("normalizes a directory name to a slug", () => {
    expect(deriveSlugFromDirectory("My Project!")).toBe("my-project");
  });

  it("falls back to a default for empty names", () => {
    expect(deriveSlugFromDirectory("@@@")).toBe("untitled-project");
  });
});

describe("deriveProjectSlug", () => {
  it("prefers the git remote when valid", () => {
    expect(
      deriveProjectSlug({
        gitRemoteUrl: "git@github.com:arxhive/pss.git",
        directoryName: "pss-mvp",
      }),
    ).toBe("github.com/arxhive/pss");
  });

  it("falls back to the directory when no remote", () => {
    expect(
      deriveProjectSlug({ gitRemoteUrl: null, directoryName: "Local Repo" }),
    ).toBe("local-repo");
  });

  it("falls back to the directory when the remote is unparseable", () => {
    expect(
      deriveProjectSlug({ gitRemoteUrl: "garbage", directoryName: "fallback" }),
    ).toBe("fallback");
  });
});

describe("generatePublicId", () => {
  it("produces ids of the configured length", () => {
    expect(generatePublicId()).toHaveLength(PUBLIC_ID_LENGTH);
    expect(generatePublicId(12)).toHaveLength(12);
  });

  it("produces only URL-safe base62 characters", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(isValidPublicId(generatePublicId())).toBe(true);
    }
  });

  it("does not collide across many generations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      ids.add(generatePublicId());
    }
    expect(ids.size).toBe(5000);
  });

  it("rejects non-positive lengths", () => {
    expect(() => generatePublicId(0)).toThrow();
  });
});

describe("isValidPublicId", () => {
  it("rejects ids with non-base62 characters", () => {
    expect(isValidPublicId("abc/def")).toBe(false);
    expect(isValidPublicId("")).toBe(false);
    expect(isValidPublicId("ok123")).toBe(true);
  });
});
