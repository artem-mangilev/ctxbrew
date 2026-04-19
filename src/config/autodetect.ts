import { join, basename } from "node:path";
import { configError } from "../utils/exit.ts";

export type DetectedMeta = { name?: string; version?: string };

const tryRead = async (path: string): Promise<string | null> => {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return file.text();
};

const fromPackageJson = async (root: string): Promise<DetectedMeta | null> => {
  const text = await tryRead(join(root, "package.json"));
  if (!text) return null;
  try {
    const json = JSON.parse(text) as { name?: unknown; version?: unknown };
    return {
      name: typeof json.name === "string" ? json.name : undefined,
      version: typeof json.version === "string" ? json.version : undefined,
    };
  } catch (e) {
    throw configError(
      `Failed to parse package.json at ${root}: ${(e as Error).message}`,
    );
  }
};

const fromCargoToml = async (root: string): Promise<DetectedMeta | null> => {
  const text = await tryRead(join(root, "Cargo.toml"));
  if (!text) return null;
  // Minimal parser for [package] section.
  const lines = text.split(/\r?\n/);
  let inPkg = false;
  let name: string | undefined;
  let version: string | undefined;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inPkg = line === "[package]";
      continue;
    }
    if (!inPkg) continue;
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.includes("#")) value = value.slice(0, value.indexOf("#")).trim();
    const sm = value.match(/^"((?:[^"\\]|\\.)*)"$/) ?? value.match(/^'([^']*)'$/);
    if (!sm) continue;
    if (key === "name") name = sm[1];
    else if (key === "version") version = sm[1];
  }
  if (!name && !version) return null;
  return { name, version };
};

const fromGoMod = async (root: string): Promise<DetectedMeta | null> => {
  const text = await tryRead(join(root, "go.mod"));
  if (!text) return null;
  const m = text.match(/^module\s+(\S+)/m);
  if (!m) return null;
  const modulePath = m[1];
  const last = modulePath.split("/").pop();
  return { name: last && last.length > 0 ? last : modulePath };
};

const fromDirName = (root: string): DetectedMeta => ({
  name: basename(root) || undefined,
});

export const autodetectMeta = async (root: string): Promise<DetectedMeta> => {
  for (const fn of [fromPackageJson, fromCargoToml, fromGoMod]) {
    const got = await fn(root);
    if (got && (got.name || got.version)) return got;
  }
  return fromDirName(root);
};
