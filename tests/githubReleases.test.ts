import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { pack } from "../src/archive/archive.ts";
import { GithubReleasesRegistry } from "../src/registry/githubReleases.ts";
import { MANIFEST_SCHEMA_VERSION, type Manifest } from "../src/registry/types.ts";
import { CtxbrewError } from "../src/utils/exit.ts";

type Release = {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{
    id: number;
    name: string;
    url: string;
    browser_download_url: string;
    size: number;
    bytes: Uint8Array;
    contentType: string;
  }>;
};

class MockGithub {
  private releases: Release[] = [];
  private nextReleaseId = 1;
  private nextAssetId = 1;
  private readonly origin: string;

  constructor(origin: string) {
    this.origin = origin;
  }

  reset(): void {
    this.releases = [];
    this.nextReleaseId = 1;
    this.nextAssetId = 1;
  }

  seedRelease(tag: string, assets: Array<{ name: string; bytes: Uint8Array; contentType: string }>): Release {
    const id = this.nextReleaseId++;
    const rel: Release = {
      id,
      tag_name: tag,
      name: tag,
      draft: false,
      prerelease: false,
      assets: assets.map((a) => {
        const aid = this.nextAssetId++;
        return {
          id: aid,
          name: a.name,
          url: `${this.origin}/repos/o/r/releases/assets/${aid}`,
          browser_download_url: `${this.origin}/download/${tag}/${a.name}`,
          size: a.bytes.byteLength,
          bytes: a.bytes,
          contentType: a.contentType,
        };
      }),
    };
    this.releases.push(rel);
    return rel;
  }

  handle = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "GET" && path === "/repos/o/r/releases") {
      const perPage = Number(url.searchParams.get("per_page") ?? "30");
      const page = Number(url.searchParams.get("page") ?? "1");
      const start = (page - 1) * perPage;
      const slice = this.releases.slice(start, start + perPage);
      return Response.json(slice);
    }

    if (req.method === "GET" && path.startsWith("/repos/o/r/releases/tags/")) {
      const tag = decodeURIComponent(path.slice("/repos/o/r/releases/tags/".length));
      const rel = this.releases.find((r) => r.tag_name === tag);
      if (!rel) return new Response("not found", { status: 404 });
      return Response.json(this.releaseSummary(rel));
    }

    if (req.method === "POST" && path === "/repos/o/r/releases") {
      const body = (await req.json()) as { tag_name: string; name?: string };
      if (this.releases.some((r) => r.tag_name === body.tag_name)) {
        return new Response("tag exists", { status: 422 });
      }
      const rel = this.seedRelease(body.tag_name, []);
      return Response.json(this.releaseSummary(rel));
    }

    if (req.method === "POST" && path.match(/^\/repos\/o\/r\/releases\/\d+\/assets$/)) {
      const releaseId = Number(path.split("/").slice(-2, -1)[0]);
      const rel = this.releases.find((r) => r.id === releaseId);
      if (!rel) return new Response("no release", { status: 404 });
      const name = url.searchParams.get("name");
      if (!name) return new Response("missing name", { status: 400 });
      const contentType = req.headers.get("content-type") ?? "application/octet-stream";
      const bytes = new Uint8Array(await req.arrayBuffer());
      const aid = this.nextAssetId++;
      const asset = {
        id: aid,
        name,
        url: `${this.origin}/repos/o/r/releases/assets/${aid}`,
        browser_download_url: `${this.origin}/download/${rel.tag_name}/${name}`,
        size: bytes.byteLength,
        bytes,
        contentType,
      };
      rel.assets.push(asset);
      return Response.json(asset);
    }

    if (req.method === "GET" && path.match(/^\/repos\/o\/r\/releases\/assets\/\d+$/)) {
      const id = Number(path.split("/").pop());
      for (const rel of this.releases) {
        const a = rel.assets.find((x) => x.id === id);
        if (a) {
          const accept = req.headers.get("accept") ?? "";
          if (accept.includes("application/octet-stream")) {
            return new Response(a.bytes, {
              status: 200,
              headers: { "Content-Type": a.contentType },
            });
          }
          return Response.json({ id: a.id, name: a.name, size: a.size });
        }
      }
      return new Response("not found", { status: 404 });
    }

    return new Response(`unhandled ${req.method} ${path}`, { status: 501 });
  };

  private releaseSummary(rel: Release) {
    return {
      id: rel.id,
      tag_name: rel.tag_name,
      name: rel.name,
      draft: rel.draft,
      prerelease: rel.prerelease,
      assets: rel.assets.map(({ bytes: _bytes, contentType: _ct, ...rest }) => rest),
    };
  }
}

const buildManifest = async (
  name: string,
  version: string,
): Promise<{ manifest: Manifest; payload: Uint8Array }> => {
  const { bytes, sha256 } = await pack({
    files: [{ path: "docs/a.md", content: `# ${name}@${version}` }],
  });
  return {
    manifest: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      name,
      version,
      publishedAt: new Date().toISOString(),
      payload: { sha256, bytes: bytes.byteLength },
      sections: { docs: { files: ["docs/a.md"] } },
    },
    payload: bytes,
  };
};

let server: ReturnType<typeof Bun.serve> | null = null;
let mock: MockGithub;
let baseUrl: string;

beforeAll(() => {
  // Two-step init: start server on ephemeral port, then tell the mock what
  // absolute origin to embed in asset URLs it returns.
  const holder = { current: null as MockGithub | null };
  server = Bun.serve({ port: 0, fetch: (req) => holder.current!.handle(req) });
  baseUrl = `http://${server.hostname}:${server.port}`;
  mock = new MockGithub(baseUrl);
  holder.current = mock;
  // Replace module-level references when reset() re-creates the mock below,
  // we reuse the same instance by calling reset() instead of reassigning.
});

afterAll(() => {
  server?.stop(true);
});

const newRegistry = (opts: { token?: string | null } = {}) =>
  new GithubReleasesRegistry({
    owner: "o",
    repo: "r",
    token: "token" in opts ? (opts.token ?? undefined) : "test-token",
    apiBase: baseUrl,
    uploadBase: baseUrl,
  });

describe("GithubReleasesRegistry", () => {
  test("publish creates release and uploads both assets", async () => {
    mock.reset();
    const reg = newRegistry();
    const { manifest, payload } = await buildManifest("demo", "1.0.0");
    await reg.publish({ manifest, payload });

    expect(await reg.listVersions("demo")).toEqual(["1.0.0"]);
    const fetched = await reg.fetchManifest("demo", "1.0.0");
    expect(fetched.name).toBe("demo");
    expect(fetched.payload.sha256).toBe(manifest.payload.sha256);
    const payloadBack = await reg.fetchPayload("demo", "1.0.0");
    expect(payloadBack.byteLength).toBe(payload.byteLength);
  });

  test("resolveVersion handles latest, exact, and ranges", async () => {
    mock.reset();
    const reg = newRegistry();
    await reg.publish(await buildManifest("demo", "1.0.0"));
    await reg.publish(await buildManifest("demo", "1.2.0"));
    await reg.publish(await buildManifest("demo", "2.0.0"));

    expect(await reg.resolveVersion("demo", "latest")).toBe("2.0.0");
    expect(await reg.resolveVersion("demo", "1.2.0")).toBe("1.2.0");
    expect(await reg.resolveVersion("demo", "^1.0.0")).toBe("1.2.0");
  });

  test("republishing the same version fails", async () => {
    mock.reset();
    const reg = newRegistry();
    const a = await buildManifest("demo", "1.0.0");
    await reg.publish(a);
    await expect(reg.publish(a)).rejects.toBeInstanceOf(CtxbrewError);
  });

  test("list groups multiple packages by name", async () => {
    mock.reset();
    const reg = newRegistry();
    await reg.publish(await buildManifest("a", "1.0.0"));
    await reg.publish(await buildManifest("b", "2.0.0"));
    await reg.publish(await buildManifest("b", "2.1.0"));
    const list = await reg.list();
    expect(list).toEqual([
      { name: "a", versions: ["1.0.0"], latest: "1.0.0" },
      { name: "b", versions: ["2.0.0", "2.1.0"], latest: "2.1.0" },
    ]);
  });

  test("fetchManifest on missing release throws typed NOT_FOUND", async () => {
    mock.reset();
    const reg = newRegistry();
    await expect(reg.fetchManifest("ghost", "1.0.0")).rejects.toBeInstanceOf(CtxbrewError);
  });

  test("publish without token fails fast", async () => {
    mock.reset();
    const reg = newRegistry({ token: null });
    await expect(reg.publish(await buildManifest("x", "1.0.0"))).rejects.toBeInstanceOf(CtxbrewError);
  });

  test("fetchManifest rejects mismatched manifest content", async () => {
    mock.reset();
    const badManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      name: "WRONG",
      version: "1.0.0",
      publishedAt: new Date().toISOString(),
      payload: { sha256: "x".repeat(64), bytes: 1 },
      sections: { docs: { files: ["x"] } },
    };
    mock.seedRelease("demo-1.0.0", [
      {
        name: "manifest.json",
        bytes: new TextEncoder().encode(JSON.stringify(badManifest)),
        contentType: "application/json",
      },
      { name: "payload.tar.gz", bytes: new Uint8Array([0x1f, 0x8b]), contentType: "application/gzip" },
    ]);
    const reg = newRegistry();
    await expect(reg.fetchManifest("demo", "1.0.0")).rejects.toBeInstanceOf(CtxbrewError);
  });
});
