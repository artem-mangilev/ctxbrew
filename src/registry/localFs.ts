import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import semver from "semver";
import { notFoundError, registryError } from "../utils/exit.ts";
import {
  latestPointer,
  manifestPath,
  payloadPath,
  pkgRegistryDir,
  pkgVersionDir,
  registryDir,
} from "../utils/paths.ts";
import type { RegistryClient } from "./client.ts";
import { type Manifest, type PublishInput, type RegistryEntry } from "./types.ts";
import { validateManifest } from "./validate.ts";

const readJsonFile = async (path: string): Promise<unknown | null> => {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return file.json();
};

const isSemver = (s: string): boolean => semver.valid(s) != null;

export class LocalFsRegistry implements RegistryClient {
  describe(): string {
    return `local:${registryDir()}`;
  }

  async listVersions(name: string): Promise<string[]> {
    const dir = pkgRegistryDir(name);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return [];
      throw registryError(`Failed to read ${dir}: ${err.message}`);
    }
    return entries.filter(isSemver).sort(semver.compare);
  }

  async list(): Promise<RegistryEntry[]> {
    let names: string[];
    try {
      names = await readdir(registryDir());
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return [];
      throw registryError(`Failed to read ${registryDir()}: ${err.message}`);
    }
    const out: RegistryEntry[] = [];
    for (const name of names.sort()) {
      const versions = await this.listVersions(name);
      if (versions.length === 0) continue;
      const latest = await this.readLatestPointer(name);
      out.push({
        name,
        versions,
        latest: latest ?? versions[versions.length - 1] ?? null,
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
      const pinned = await this.readLatestPointer(name);
      if (pinned && versions.includes(pinned)) return pinned;
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
    const m = await readJsonFile(manifestPath(name, version));
    if (!m) {
      throw notFoundError(
        `Manifest for "${name}@${version}" not found in registry ${this.describe()}`,
      );
    }
    return validateManifest(m, name, version);
  }

  async fetchPayload(name: string, version: string): Promise<Uint8Array> {
    const file = Bun.file(payloadPath(name, version));
    if (!(await file.exists())) {
      throw notFoundError(
        `Payload for "${name}@${version}" not found in registry ${this.describe()}`,
      );
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  async publish({ manifest, payload }: PublishInput): Promise<void> {
    const versionDir = pkgVersionDir(manifest.name, manifest.version);
    await mkdir(versionDir, { recursive: true });
    await Bun.write(manifestPath(manifest.name, manifest.version), JSON.stringify(manifest, null, 2));
    await Bun.write(payloadPath(manifest.name, manifest.version), payload);
    await Bun.write(latestPointer(manifest.name), manifest.version);
  }

  private async readLatestPointer(name: string): Promise<string | null> {
    const file = Bun.file(latestPointer(name));
    if (!(await file.exists())) return null;
    const v = (await file.text()).trim();
    return v.length > 0 ? v : null;
  }
}

export const removePackageFromRegistry = async (name?: string): Promise<void> => {
  const target = name ? pkgRegistryDir(name) : registryDir();
  await rm(target, { recursive: true, force: true });
};

export const removeVersionFromRegistry = async (name: string, version: string): Promise<void> => {
  await rm(join(pkgRegistryDir(name), version), { recursive: true, force: true });
};
