import { describe, expect, test } from "bun:test";
import { getRegistry } from "../src/registry/factory.ts";
import { GithubReleasesRegistry } from "../src/registry/githubReleases.ts";
import { LocalFsRegistry } from "../src/registry/localFs.ts";
import { CtxbrewError } from "../src/utils/exit.ts";

describe("getRegistry", () => {
  test("defaults to LocalFsRegistry when CTXBREW_REGISTRY is unset", () => {
    const reg = getRegistry({});
    expect(reg).toBeInstanceOf(LocalFsRegistry);
  });

  test("returns LocalFsRegistry when CTXBREW_REGISTRY=local", () => {
    const reg = getRegistry({ CTXBREW_REGISTRY: "local" });
    expect(reg).toBeInstanceOf(LocalFsRegistry);
  });

  test("returns GithubReleasesRegistry when CTXBREW_REGISTRY=github with repo spec", () => {
    const reg = getRegistry({
      CTXBREW_REGISTRY: "github",
      CTXBREW_GITHUB_REPO: "my-org/ctxbrew-registry",
      CTXBREW_GITHUB_TOKEN: "ghp_xxx",
    });
    expect(reg).toBeInstanceOf(GithubReleasesRegistry);
    expect(reg.describe()).toBe("github:my-org/ctxbrew-registry");
  });

  test("accepts owner/repo.git suffix", () => {
    const reg = getRegistry({
      CTXBREW_REGISTRY: "github",
      CTXBREW_GITHUB_REPO: "acme/reg.git",
    });
    expect(reg.describe()).toBe("github:acme/reg");
  });

  test("rejects github kind without CTXBREW_GITHUB_REPO", () => {
    expect(() => getRegistry({ CTXBREW_REGISTRY: "github" })).toThrow(CtxbrewError);
  });

  test("rejects malformed CTXBREW_GITHUB_REPO", () => {
    expect(() =>
      getRegistry({ CTXBREW_REGISTRY: "github", CTXBREW_GITHUB_REPO: "not-a-repo" }),
    ).toThrow(CtxbrewError);
  });

  test("rejects unknown CTXBREW_REGISTRY value", () => {
    expect(() => getRegistry({ CTXBREW_REGISTRY: "s3" })).toThrow(CtxbrewError);
  });

  test("is case-insensitive and trims", () => {
    const reg = getRegistry({ CTXBREW_REGISTRY: "  LOCAL  " });
    expect(reg).toBeInstanceOf(LocalFsRegistry);
  });
});
