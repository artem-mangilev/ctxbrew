import { homedir } from "node:os";
import { join } from "node:path";

const HOME_DIR_NAME = ".ctxbrew";

export const ctxbrewHome = (): string => {
  if (process.env.CTXBREW_HOME) return process.env.CTXBREW_HOME;
  return join(homedir(), HOME_DIR_NAME);
};

export const registryDir = (): string => join(ctxbrewHome(), "registry");

export const cacheDir = (): string => join(ctxbrewHome(), "cache");

export const pkgRegistryDir = (name: string): string => join(registryDir(), name);

export const pkgVersionDir = (name: string, version: string): string =>
  join(registryDir(), name, version);

export const pkgCacheDir = (name: string, version: string): string =>
  join(cacheDir(), name, version);

export const latestPointer = (name: string): string => join(pkgRegistryDir(name), "latest");

export const manifestPath = (name: string, version: string): string =>
  join(pkgVersionDir(name, version), "manifest.json");

export const payloadPath = (name: string, version: string): string =>
  join(pkgVersionDir(name, version), "payload.tar.gz");
