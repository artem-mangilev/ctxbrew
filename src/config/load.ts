import { join } from "node:path";
import semver from "semver";
import { configError } from "../utils/exit.ts";
import { autodetectMeta } from "./autodetect.ts";
import {
  DEFAULT_LIMITS,
  PACKAGE_NAME_RE,
  CtxbrewConfigSchema,
  type ResolvedConfig,
  type CtxbrewConfig,
} from "./schema.ts";

export type LoadedConfig = {
  config: ResolvedConfig;
  configPath: string;
  rootDir: string;
};

const CANDIDATES = ["ctxbrew.config.json", ".ctxbrewrc.json", ".ctxbrewrc"] as const;

const readJson = async (path: string): Promise<unknown | null> => {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  const text = await file.text();
  if (text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw configError(
      `Invalid JSON in ${path}: ${(e as Error).message}`,
      "ctxbrew currently supports JSON config only (ctxbrew.config.json, .ctxbrewrc[.json], or `ctxbrew` in package.json).",
    );
  }
};

type ConfigSource = { raw: unknown; path: string };

const findConfigSource = async (root: string): Promise<ConfigSource | null> => {
  for (const name of CANDIDATES) {
    const path = join(root, name);
    const raw = await readJson(path);
    if (raw !== null) return { raw, path };
  }
  // package.json#ctxbrew
  const pkgPath = join(root, "package.json");
  const pkg = await readJson(pkgPath);
  if (pkg && typeof pkg === "object" && "ctxbrew" in (pkg as Record<string, unknown>)) {
    return { raw: (pkg as Record<string, unknown>).ctxbrew, path: `${pkgPath}#ctxbrew` };
  }
  return null;
};

const normalizePatterns = (cli: CtxbrewConfig["cli"]): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [section, value] of Object.entries(cli)) {
    out[section] = Array.isArray(value) ? value : [value];
  }
  return out;
};

export type LoadConfigOptions = {
  versionOverride?: string;
};

export const loadConfig = async (
  cwd: string = process.cwd(),
  opts: LoadConfigOptions = {},
): Promise<LoadedConfig> => {
  const source = await findConfigSource(cwd);
  if (!source) {
    throw configError(
      `No ctxbrew config found in ${cwd}`,
      "Run `ctxb init` to create a starter ctxbrew.config.json.",
    );
  }
  const parsed = CtxbrewConfigSchema.safeParse(source.raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw configError(`Invalid ctxbrew config at ${source.path}:\n${issues}`);
  }
  const cfg = parsed.data;

  let name = cfg.name;
  let version = opts.versionOverride ?? cfg.version;
  if (!name || !version) {
    const detected = await autodetectMeta(cwd);
    name ??= detected.name;
    version ??= detected.version;
  }

  if (!name) {
    throw configError(
      "Could not determine package `name`",
      "Set `name` in ctxbrew.config.json, or add a name to package.json/Cargo.toml/go.mod.",
    );
  }
  if (!PACKAGE_NAME_RE.test(name)) {
    throw configError(
      `Resolved package name "${name}" does not match ${PACKAGE_NAME_RE}`,
      "Set an explicit `name` in ctxbrew.config.json that matches the pattern.",
    );
  }
  if (!version) {
    throw configError(
      "Could not determine package `version`",
      "Set `version` in ctxbrew.config.json, or in your language manifest (package.json/Cargo.toml).",
    );
  }
  const cleanVersion = semver.valid(semver.coerce(version) ?? version);
  if (!cleanVersion) {
    throw configError(
      `Resolved version "${version}" is not valid semver`,
      "Use a semver string like 1.2.3.",
    );
  }

  const limits = {
    maxBytes: cfg.limits?.maxBytes ?? DEFAULT_LIMITS.maxBytes,
    maxFiles: cfg.limits?.maxFiles ?? DEFAULT_LIMITS.maxFiles,
  };

  const resolved: ResolvedConfig = {
    name,
    version: cleanVersion,
    cli: normalizePatterns(cfg.cli),
    limits,
    extensions: cfg.extensions ?? {},
  };

  return { config: resolved, configPath: source.path, rootDir: cwd };
};
