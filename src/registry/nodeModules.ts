import { createRequire } from "node:module";
import { dirname, join, normalize, sep } from "node:path";
import { notFoundError, registryError } from "../utils/exit.ts";
import type { Manifest } from "./types.ts";
import { validateManifest } from "./validate.ts";

const CTXBREW_DIR = ".ctxbrew";
const FILES_DIR = "files";

const normalizeRelativePath = (relPath: string): string => {
  const normalized = normalize(relPath).replaceAll("\\", "/");
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    normalized.startsWith("/")
  ) {
    throw registryError(`Invalid file path "${relPath}" in section manifest`);
  }
  if (normalized.split("/").some((segment) => segment.length === 0 || segment === ".")) {
    throw registryError(`Invalid file path "${relPath}" in section manifest`);
  }
  return normalized;
};

export const resolvePackageDir = (name: string, cwd: string): string => {
  try {
    const req = createRequire(join(cwd, "__ctxbrew__.js"));
    const pkgJsonPath = req.resolve(`${name}/package.json`);
    return dirname(pkgJsonPath);
  } catch {
    throw notFoundError(`Package "${name}" is not installed from ${cwd}`);
  }
};

const resolveCtxbrewDir = async (name: string, cwd: string): Promise<string> => {
  const packageDir = resolvePackageDir(name, cwd);
  const dir = join(packageDir, CTXBREW_DIR);
  const manifestPath = join(dir, "manifest.json");
  if (!(await Bun.file(manifestPath).exists())) {
    throw notFoundError(`Package "${name}" does not contain ${CTXBREW_DIR} metadata`);
  }
  return dir;
};

export const readManifest = async (name: string, cwd: string): Promise<Manifest> => {
  const ctxbrewDir = await resolveCtxbrewDir(name, cwd);
  const manifestPath = join(ctxbrewDir, "manifest.json");
  const file = Bun.file(manifestPath);
  if (!(await file.exists())) {
    throw notFoundError(`Manifest missing for package "${name}"`);
  }

  let raw: unknown;
  try {
    raw = await file.json();
  } catch (error) {
    throw registryError(
      `Manifest for "${name}" is invalid JSON: ${(error as Error).message}`,
    );
  }
  const parsed = raw as Partial<Manifest>;
  if (typeof parsed.version !== "string") {
    throw registryError(`Manifest for "${name}" is missing version`);
  }
  return validateManifest(raw, name, parsed.version);
};

export const readSectionFile = async (
  name: string,
  cwd: string,
  relPath: string,
): Promise<string> => {
  const ctxbrewDir = await resolveCtxbrewDir(name, cwd);
  const normalized = normalizeRelativePath(relPath);
  const fullPath = join(ctxbrewDir, FILES_DIR, normalized.replaceAll("/", sep));
  const file = Bun.file(fullPath);
  if (!(await file.exists())) {
    throw notFoundError(`File "${relPath}" is missing in package "${name}"`);
  }
  return file.text();
};
