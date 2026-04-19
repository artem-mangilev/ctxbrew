import semver from "semver";
import { notFoundError, registryError } from "../utils/exit.ts";
import type { RegistryClient } from "./client.ts";
import { type Manifest, type PublishInput, type RegistryEntry } from "./types.ts";
import { validateManifest } from "./validate.ts";

export type GithubReleasesConfig = {
  owner: string;
  repo: string;
  token?: string;
  apiBase?: string;
  uploadBase?: string;
  userAgent?: string;
};

type GithubAsset = {
  id: number;
  name: string;
  url: string;
  browser_download_url: string;
  size: number;
};

type GithubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: GithubAsset[];
};

const MANIFEST_ASSET = "manifest.json";
const PAYLOAD_ASSET = "payload.tar.gz";
const DEFAULT_API = "https://api.github.com";
const DEFAULT_UPLOAD = "https://uploads.github.com";
const DEFAULT_UA = "ctxbrew";
const PER_PAGE = 100;

const tagFor = (name: string, version: string): string => `${name}-${version}`;

// Some package names may contain characters that are unusual (but allowed) in
// git tags. Current schema (see src/config/schema.ts) restricts names to
// [a-z0-9-], so tagFor() is already safe. We still parse defensively below.
const parseTag = (tag: string): { name: string; version: string } | null => {
  const idx = tag.lastIndexOf("-");
  if (idx <= 0 || idx === tag.length - 1) return null;
  const name = tag.slice(0, idx);
  const version = tag.slice(idx + 1);
  if (!semver.valid(version)) return null;
  return { name, version };
};

export class GithubReleasesRegistry implements RegistryClient {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token?: string;
  private readonly apiBase: string;
  private readonly uploadBase: string;
  private readonly userAgent: string;

  constructor(cfg: GithubReleasesConfig) {
    if (!cfg.owner) throw registryError("GithubReleasesRegistry: owner is required");
    if (!cfg.repo) throw registryError("GithubReleasesRegistry: repo is required");
    this.owner = cfg.owner;
    this.repo = cfg.repo;
    this.token = cfg.token;
    this.apiBase = (cfg.apiBase ?? DEFAULT_API).replace(/\/+$/, "");
    this.uploadBase = (cfg.uploadBase ?? DEFAULT_UPLOAD).replace(/\/+$/, "");
    this.userAgent = cfg.userAgent ?? DEFAULT_UA;
  }

  describe(): string {
    return `github:${this.owner}/${this.repo}`;
  }

  async listVersions(name: string): Promise<string[]> {
    const releases = await this.listAllReleases();
    const versions = releases
      .map((r) => parseTag(r.tag_name))
      .filter((p): p is { name: string; version: string } => p !== null && p.name === name)
      .map((p) => p.version);
    return versions.sort(semver.compare);
  }

  async list(): Promise<RegistryEntry[]> {
    const releases = await this.listAllReleases();
    const byName = new Map<string, string[]>();
    for (const rel of releases) {
      const parsed = parseTag(rel.tag_name);
      if (!parsed) continue;
      const bucket = byName.get(parsed.name) ?? [];
      bucket.push(parsed.version);
      byName.set(parsed.name, bucket);
    }
    const out: RegistryEntry[] = [];
    for (const [name, versions] of [...byName.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const sorted = versions.sort(semver.compare);
      out.push({
        name,
        versions: sorted,
        latest: sorted[sorted.length - 1] ?? null,
      });
    }
    return out;
  }

  async resolveVersion(name: string, range: string): Promise<string> {
    const versions = await this.listVersions(name);
    if (versions.length === 0) {
      throw notFoundError(`Package "${name}" is not in registry ${this.describe()}`);
    }
    if (range === "latest" || range === "*" || range === "") {
      return versions[versions.length - 1];
    }
    const explicit = semver.valid(range);
    if (explicit) {
      if (!versions.includes(explicit)) {
        throw notFoundError(
          `Version ${explicit} of "${name}" not found. Available: ${versions.join(", ")}`,
        );
      }
      return explicit;
    }
    const max = semver.maxSatisfying(versions, range);
    if (!max) {
      throw notFoundError(
        `No version of "${name}" satisfies "${range}". Available: ${versions.join(", ")}`,
      );
    }
    return max;
  }

  async fetchManifest(name: string, version: string): Promise<Manifest> {
    const release = await this.getRelease(name, version);
    const asset = release.assets.find((a) => a.name === MANIFEST_ASSET);
    if (!asset) {
      throw notFoundError(
        `Manifest asset "${MANIFEST_ASSET}" missing from release ${release.tag_name} in ${this.describe()}`,
      );
    }
    const raw = await this.downloadJsonAsset(asset);
    return validateManifest(raw, name, version);
  }

  async fetchPayload(name: string, version: string): Promise<Uint8Array> {
    const release = await this.getRelease(name, version);
    const asset = release.assets.find((a) => a.name === PAYLOAD_ASSET);
    if (!asset) {
      throw notFoundError(
        `Payload asset "${PAYLOAD_ASSET}" missing from release ${release.tag_name} in ${this.describe()}`,
      );
    }
    return this.downloadBinaryAsset(asset);
  }

  async publish({ manifest, payload }: PublishInput): Promise<void> {
    if (!this.token) {
      throw registryError(
        "GithubReleasesRegistry: publish requires an auth token",
        "Set CTXBREW_GITHUB_TOKEN (or GH_TOKEN / GITHUB_TOKEN).",
      );
    }
    const tag = tagFor(manifest.name, manifest.version);
    const existing = await this.findReleaseByTag(tag);
    if (existing) {
      throw registryError(
        `Release ${tag} already exists in ${this.describe()}`,
        "Bump the version (publish is immutable).",
      );
    }
    const created = await this.createRelease(tag, manifest);
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    await this.uploadAsset(created.id, MANIFEST_ASSET, manifestBytes, "application/json");
    await this.uploadAsset(created.id, PAYLOAD_ASSET, payload, "application/gzip");
  }

  // ---- helpers ----

  private authHeaders(accept: string): Headers {
    const h = new Headers({
      "Accept": accept,
      "User-Agent": this.userAgent,
      "X-GitHub-Api-Version": "2022-11-28",
    });
    if (this.token) h.set("Authorization", `Bearer ${this.token}`);
    return h;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = path.startsWith("http") ? path : `${this.apiBase}${path}`;
    const headers = this.authHeaders("application/vnd.github+json");
    const incoming = new Headers(init.headers);
    incoming.forEach((v, k) => headers.set(k, v));
    const res = await fetch(url, { ...init, headers });
    return res;
  }

  private async listAllReleases(): Promise<GithubRelease[]> {
    const all: GithubRelease[] = [];
    for (let page = 1; ; page++) {
      const res = await this.request(
        `/repos/${this.owner}/${this.repo}/releases?per_page=${PER_PAGE}&page=${page}`,
      );
      if (res.status === 404) {
        throw notFoundError(
          `GitHub repo ${this.owner}/${this.repo} not found or no access`,
          this.token ? "Check your token scopes." : "Set CTXBREW_GITHUB_TOKEN for private repos.",
        );
      }
      if (!res.ok) {
        throw registryError(`GitHub listReleases failed: ${res.status} ${res.statusText}`);
      }
      const batch = (await res.json()) as GithubRelease[];
      all.push(...batch);
      if (batch.length < PER_PAGE) break;
    }
    return all;
  }

  private async findReleaseByTag(tag: string): Promise<GithubRelease | null> {
    const res = await this.request(
      `/repos/${this.owner}/${this.repo}/releases/tags/${encodeURIComponent(tag)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw registryError(`GitHub getReleaseByTag failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as GithubRelease;
  }

  private async getRelease(name: string, version: string): Promise<GithubRelease> {
    const tag = tagFor(name, version);
    const rel = await this.findReleaseByTag(tag);
    if (!rel) {
      throw notFoundError(
        `Release ${tag} not found in ${this.describe()}`,
      );
    }
    return rel;
  }

  private async createRelease(tag: string, manifest: Manifest): Promise<GithubRelease> {
    const body = {
      tag_name: tag,
      name: tag,
      body: `ctxbrew bundle \`${manifest.name}@${manifest.version}\` published at ${manifest.publishedAt}.`,
      draft: false,
      prerelease: semver.prerelease(manifest.version) !== null,
    };
    const res = await this.request(`/repos/${this.owner}/${this.repo}/releases`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw registryError(
        `GitHub createRelease failed: ${res.status} ${res.statusText} ${detail}`,
      );
    }
    return (await res.json()) as GithubRelease;
  }

  private async uploadAsset(
    releaseId: number,
    filename: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<GithubAsset> {
    const url = `${this.uploadBase}/repos/${this.owner}/${this.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(filename)}`;
    const headers = this.authHeaders("application/vnd.github+json");
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", String(bytes.byteLength));
    const res = await fetch(url, { method: "POST", body: bytes, headers });
    if (!res.ok) {
      const detail = await res.text();
      throw registryError(
        `GitHub uploadAsset(${filename}) failed: ${res.status} ${res.statusText} ${detail}`,
      );
    }
    return (await res.json()) as GithubAsset;
  }

  private async downloadJsonAsset(asset: GithubAsset): Promise<unknown> {
    const bytes = await this.downloadBinaryAsset(asset);
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw registryError(`Asset ${asset.name} is not valid JSON: ${msg}`);
    }
  }

  private async downloadBinaryAsset(asset: GithubAsset): Promise<Uint8Array> {
    // Authenticated API endpoint with Accept: application/octet-stream works for
    // both public and private releases; it avoids the second redirect hop of
    // browser_download_url for private repos where the token must be present.
    const headers = this.authHeaders("application/octet-stream");
    const res = await fetch(asset.url, { headers, redirect: "follow" });
    if (!res.ok) {
      throw registryError(
        `GitHub downloadAsset(${asset.name}) failed: ${res.status} ${res.statusText}`,
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
