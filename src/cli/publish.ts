import { Command } from "commander";
import semver from "semver";
import { pack } from "../archive/archive.ts";
import { loadConfig } from "../config/load.ts";
import { collectFiles } from "../extract/collect.ts";
import { LocalFsRegistry } from "../registry/localFs.ts";
import { MANIFEST_SCHEMA_VERSION, type Manifest } from "../registry/types.ts";
import { configError } from "../utils/exit.ts";
import { colorize, logger } from "../utils/logger.ts";

type Options = {
  version?: string;
  dryRun?: boolean;
  cwd?: string;
};

const INTERNAL_LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  maxFiles: 5000,
};

const enforceLimits = (
  bytesByFile: Map<string, number>,
  caps: { maxBytes: number; maxFiles: number },
): void => {
  if (bytesByFile.size > caps.maxFiles) {
    throw configError(
      `Publish exceeds maxFiles cap (${bytesByFile.size} > ${caps.maxFiles})`,
      "Tighten your ctxbrew.cli globs to publish fewer files.",
    );
  }
  let total = 0;
  for (const b of bytesByFile.values()) total += b;
  if (total > caps.maxBytes) {
    throw configError(
      `Publish exceeds maxBytes cap (${total} > ${caps.maxBytes})`,
      "Tighten your ctxbrew.cli globs to reduce publish size.",
    );
  }
};

export const runPublish = async (opts: Options): Promise<void> => {
  const cwd = opts.cwd ?? process.cwd();
  let versionOverride: string | undefined;
  if (opts.version) {
    const v = semver.valid(semver.coerce(opts.version) ?? opts.version);
    if (!v) throw configError(`--version "${opts.version}" is not valid semver`);
    versionOverride = v;
  }
  const { config, configPath } = await loadConfig(cwd, { versionOverride });

  logger.info(
    `publishing ${colorize.bold(config.name)}@${config.version} (config: ${configPath})`,
  );

  const sectionFiles: Record<string, string[]> = {};
  const allFiles = new Map<string, Uint8Array>();
  const bytesByFile = new Map<string, number>();

  for (const [section, patterns] of Object.entries(config.cli)) {
    const matched = await collectFiles({ root: cwd, patterns });
    if (matched.length === 0) {
      logger.warn(`section "${section}" matched 0 files`);
    }
    sectionFiles[section] = matched;
    for (const rel of matched) {
      if (allFiles.has(rel)) continue;
      const file = Bun.file(`${cwd}/${rel}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      allFiles.set(rel, bytes);
      bytesByFile.set(rel, bytes.byteLength);
    }
  }

  enforceLimits(bytesByFile, INTERNAL_LIMITS);

  const sortedFiles = [...allFiles.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, content]) => ({ path, content }));

  const { bytes: payload, sha256 } = await pack({ files: sortedFiles });

  const manifest: Manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    name: config.name,
    version: config.version,
    publishedAt: new Date().toISOString(),
    payload: { sha256, bytes: payload.byteLength },
    sections: Object.fromEntries(
      Object.entries(sectionFiles).map(([k, v]) => [k, { files: v }]),
    ),
  };

  if (opts.dryRun) {
    logger.info(
      `dry-run: would publish ${sortedFiles.length} file(s), payload ${payload.byteLength} bytes, sha256 ${sha256.slice(0, 12)}`,
    );
    for (const [section, files] of Object.entries(sectionFiles)) {
      logger.info(`  - ${section}: ${files.length} file(s)`);
    }
    return;
  }

  const registry = new LocalFsRegistry();
  await registry.publish({ manifest, payload });

  logger.success(
    `published ${config.name}@${config.version} -> ${registry.describe()} (${sortedFiles.length} files, ${payload.byteLength} bytes)`,
  );
};

export const registerPublishCommand = (program: Command): void => {
  program
    .command("publish")
    .description("Pack matched files and publish to the registry")
    .option("--version <semver>", "override version from config/package manifest")
    .option("--dry-run", "validate and pack but do not write to registry")
    .option("--cwd <dir>", "project root (defaults to current directory)")
    .action(async (opts: Options) => {
      await runPublish(opts);
    });
};
