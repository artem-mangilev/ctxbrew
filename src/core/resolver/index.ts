import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "../../utils/logger.ts";
import { readIndexManifest } from "../index-manifest.ts";
import { CURRENT_PROTOCOL_VERSION, isSupportedProtocolVersion } from "../protocol.ts";
import { discoverBunIndexPaths } from "./bun.ts";
import { discoverNpmIndexPaths } from "./npm.ts";
import { discoverPnpmIndexPaths } from "./pnpm.ts";
import type { DiscoveredPackage } from "./types.ts";

type CacheState = {
  lockPath: string | null;
  lockMtimeMs: number | null;
  packages: DiscoveredPackage[];
};

const CACHE_PATH = (cwd: string) => join(cwd, "node_modules/.cache/ctxbrew/index.json");

const readPackageName = async (packageRoot: string): Promise<{ name: string; version: string }> => {
  const pkgPath = join(packageRoot, "package.json");
  const file = Bun.file(pkgPath);
  if (!(await file.exists())) {
    throw new Error(`missing package.json for ${packageRoot}`);
  }
  const pkg = (await file.json()) as { name?: string; version?: string };
  if (!pkg.name || !pkg.version) {
    throw new Error(`invalid package.json for ${packageRoot}`);
  }
  return { name: pkg.name, version: pkg.version };
};

const getLockState = async (cwd: string): Promise<{ path: string | null; mtimeMs: number | null }> => {
  for (const candidate of ["pnpm-lock.yaml", "bun.lock", "package-lock.json", "yarn.lock"]) {
    const path = join(cwd, candidate);
    const file = Bun.file(path);
    if (await file.exists()) {
      return { path, mtimeMs: file.lastModified };
    }
  }
  return { path: null, mtimeMs: null };
};

const readCache = async (cwd: string): Promise<CacheState | null> => {
  const path = CACHE_PATH(cwd);
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    const raw = (await file.json()) as CacheState;
    return raw;
  } catch {
    return null;
  }
};

const writeCache = async (cwd: string, cache: CacheState): Promise<void> => {
  const path = CACHE_PATH(cwd);
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, `${JSON.stringify(cache, null, 2)}\n`);
};

const shouldUseCache = (
  cache: CacheState,
  lockState: { path: string | null; mtimeMs: number | null },
): boolean => {
  return cache.lockPath === lockState.path && cache.lockMtimeMs === lockState.mtimeMs;
};

export const discoverCtxbrewPackages = async (cwd: string): Promise<DiscoveredPackage[]> => {
  const lockState = await getLockState(cwd);
  const cached = await readCache(cwd);
  if (cached && shouldUseCache(cached, lockState)) {
    return cached.packages;
  }

  const discoveredPaths = new Set<string>();
  for (const provider of [discoverNpmIndexPaths, discoverPnpmIndexPaths, discoverBunIndexPaths]) {
    const items = await provider(cwd);
    for (const item of items) discoveredPaths.add(item);
  }

  const packages: DiscoveredPackage[] = [];
  for (const indexPath of discoveredPaths) {
    const packageRoot = dirname(dirname(indexPath));
    let pkgMeta: { name: string; version: string };
    try {
      pkgMeta = await readPackageName(packageRoot);
    } catch {
      continue;
    }

    let manifest;
    try {
      manifest = await readIndexManifest(indexPath);
    } catch (error) {
      logger.warn((error as Error).message);
      continue;
    }
    if (!isSupportedProtocolVersion(manifest.version)) {
      logger.warn(
        `${pkgMeta.name} uses ctxbrew protocol v${manifest.version}, update your ctxbrew CLI (supports up to v${CURRENT_PROTOCOL_VERSION}).`,
      );
      continue;
    }
    packages.push({
      name: pkgMeta.name,
      version: pkgMeta.version,
      packageRoot,
      indexPath,
      manifest,
    });
  }

  packages.sort((a, b) => a.name.localeCompare(b.name));
  await writeCache(cwd, {
    lockPath: lockState.path,
    lockMtimeMs: lockState.mtimeMs,
    packages,
  });
  return packages;
};

export const resolveDiscoveredPackage = async (
  cwd: string,
  packageName: string,
): Promise<DiscoveredPackage | null> => {
  const packages = await discoverCtxbrewPackages(cwd);
  return packages.find((pkg) => pkg.name === packageName) ?? null;
};
