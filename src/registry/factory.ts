import { configError } from "../utils/exit.ts";
import type { RegistryClient } from "./client.ts";
import { GithubReleasesRegistry } from "./githubReleases.ts";
import { LocalFsRegistry } from "./localFs.ts";

export type RegistryKind = "local" | "github";

type Env = Record<string, string | undefined>;

const readEnv = (env: Env): { kind: RegistryKind } => {
  const raw = (env.CTXBREW_REGISTRY ?? "local").trim().toLowerCase();
  if (raw === "local" || raw === "github") return { kind: raw };
  throw configError(
    `Unknown CTXBREW_REGISTRY="${raw}"`,
    "Expected one of: local, github.",
  );
};

const parseRepoSpec = (spec: string): { owner: string; repo: string } => {
  const m = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(spec.trim());
  if (!m) {
    throw configError(
      `CTXBREW_GITHUB_REPO="${spec}" is not "owner/repo"`,
      "Example: CTXBREW_GITHUB_REPO=my-org/ctxbrew-registry",
    );
  }
  return { owner: m[1], repo: m[2] };
};

export const getRegistry = (env: Env = process.env): RegistryClient => {
  const { kind } = readEnv(env);
  if (kind === "local") return new LocalFsRegistry();
  if (kind === "github") {
    const repoSpec = env.CTXBREW_GITHUB_REPO;
    if (!repoSpec) {
      throw configError(
        "CTXBREW_REGISTRY=github requires CTXBREW_GITHUB_REPO",
        "Set CTXBREW_GITHUB_REPO=owner/repo.",
      );
    }
    const { owner, repo } = parseRepoSpec(repoSpec);
    const token = env.CTXBREW_GITHUB_TOKEN ?? env.GH_TOKEN ?? env.GITHUB_TOKEN;
    const apiBase = env.CTXBREW_GITHUB_API_BASE;
    const uploadBase = env.CTXBREW_GITHUB_UPLOAD_BASE;
    return new GithubReleasesRegistry({ owner, repo, token, apiBase, uploadBase });
  }
  throw configError(`Unreachable registry kind: ${kind satisfies never}`);
};
