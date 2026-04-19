import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { verifyAndExtract } from "../archive/archive.ts";
import type { RegistryClient } from "../registry/client.ts";
import type { Manifest } from "../registry/types.ts";
import { notFoundError } from "../utils/exit.ts";
import { logger } from "../utils/logger.ts";
import { cacheDir, pkgCacheDir } from "../utils/paths.ts";

const READY_MARKER = ".ctxbrew-ready";

const isReady = async (dir: string, expectedSha256: string): Promise<boolean> => {
  try {
    const markerPath = join(dir, READY_MARKER);
    const s = await stat(markerPath);
    if (!s.isFile()) return false;
    const actual = (await Bun.file(markerPath).text()).trim();
    return actual === expectedSha256;
  } catch {
    return false;
  }
};

const markReady = async (dir: string, sha256: string): Promise<void> => {
  await Bun.write(join(dir, READY_MARKER), sha256);
};

export type EnsureOptions = {
  noCache?: boolean;
};

export const ensureCached = async (
  registry: RegistryClient,
  manifest: Manifest,
  opts: EnsureOptions = {},
): Promise<string> => {
  const dir = pkgCacheDir(manifest.name, manifest.version);

  if (!opts.noCache && (await isReady(dir, manifest.payload.sha256))) {
    logger.debug(`cache hit ${manifest.name}@${manifest.version}`);
    return dir;
  }

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  logger.info(`fetching ${manifest.name}@${manifest.version} from ${registry.describe()}`);
  const payload = await registry.fetchPayload(manifest.name, manifest.version);
  await verifyAndExtract(payload, manifest.payload.sha256, dir);
  await markReady(dir, manifest.payload.sha256);
  return dir;
};

export const readSectionFiles = async (
  cacheDirPath: string,
  filePaths: string[],
): Promise<Array<{ path: string; content: string }>> => {
  const out: Array<{ path: string; content: string }> = [];
  for (const rel of filePaths) {
    const file = Bun.file(join(cacheDirPath, rel));
    if (!(await file.exists())) {
      throw notFoundError(
        `File "${rel}" listed in manifest is missing from extracted payload`,
        "Try `ctxb cache clear <name>` and re-fetch.",
      );
    }
    out.push({ path: rel, content: await file.text() });
  }
  return out;
};

export const clearCache = async (name?: string): Promise<void> => {
  if (!name) {
    await rm(cacheDir(), { recursive: true, force: true });
    return;
  }
  await rm(join(cacheDir(), name), { recursive: true, force: true });
};

export const pruneCache = async (registry: RegistryClient): Promise<{ removed: string[] }> => {
  const live = new Set<string>();
  for (const entry of await registry.list()) {
    for (const v of entry.versions) live.add(`${entry.name}/${v}`);
  }
  const removed: string[] = [];
  const { readdir } = await import("node:fs/promises");
  let names: string[];
  try {
    names = await readdir(cacheDir());
  } catch {
    return { removed };
  }
  for (const name of names) {
    let versions: string[];
    try {
      versions = await readdir(join(cacheDir(), name));
    } catch {
      continue;
    }
    for (const v of versions) {
      if (!live.has(`${name}/${v}`)) {
        await rm(join(cacheDir(), name, v), { recursive: true, force: true });
        removed.push(`${name}@${v}`);
      }
    }
  }
  return { removed };
};
