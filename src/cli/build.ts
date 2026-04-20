import { Command } from "commander";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import semver from "semver";
import { loadConfig } from "../config/load.ts";
import { collectFiles } from "../extract/collect.ts";
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
      `Build exceeds maxFiles cap (${bytesByFile.size} > ${caps.maxFiles})`,
      "Tighten your ctxbrew.cli globs to include fewer files.",
    );
  }
  let total = 0;
  for (const b of bytesByFile.values()) total += b;
  if (total > caps.maxBytes) {
    throw configError(
      `Build exceeds maxBytes cap (${total} > ${caps.maxBytes})`,
      "Tighten your ctxbrew.cli globs to reduce total size.",
    );
  }
};

export const runBuild = async (opts: Options): Promise<void> => {
  const cwd = opts.cwd ?? process.cwd();
  const ctxbrewDir = join(cwd, ".ctxbrew");
  const ctxbrewFilesDir = join(ctxbrewDir, "files");
  let versionOverride: string | undefined;
  if (opts.version) {
    const v = semver.valid(semver.coerce(opts.version) ?? opts.version);
    if (!v) throw configError(`--version "${opts.version}" is not valid semver`);
    versionOverride = v;
  }
  const { config, configPath } = await loadConfig(cwd, { versionOverride });

  logger.info(
    `building ${colorize.bold(config.name)}@${config.version} (config: ${configPath})`,
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

  const manifest: Manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    name: config.name,
    version: config.version,
    publishedAt: new Date().toISOString(),
    sections: Object.fromEntries(
      Object.entries(sectionFiles).map(([k, v]) => [k, { files: v }]),
    ),
  };

  if (opts.dryRun) {
    logger.info(
      `dry-run: would write ${sortedFiles.length} file(s) to ${ctxbrewDir}`,
    );
    for (const [section, files] of Object.entries(sectionFiles)) {
      logger.info(`  - ${section}: ${files.length} file(s)`);
    }
    return;
  }

  await rm(ctxbrewDir, { recursive: true, force: true });
  await mkdir(ctxbrewFilesDir, { recursive: true });

  for (const { path, content } of sortedFiles) {
    const outPath = join(ctxbrewFilesDir, path);
    await mkdir(dirname(outPath), { recursive: true });
    await Bun.write(outPath, content);
  }
  await Bun.write(join(ctxbrewDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  logger.success(
    `prepared ${config.name}@${config.version} -> ${ctxbrewDir} (${sortedFiles.length} files)`,
  );
};

export const registerBuildCommand = (program: Command): void => {
  program
    .command("build")
    .description("Build .ctxbrew artifacts to be included in npm publish")
    .option("--version <semver>", "override version from config/package manifest")
    .option("--dry-run", "validate and collect files but do not write .ctxbrew")
    .option("--cwd <dir>", "project root (defaults to current directory)")
    .action(async (opts: Options) => {
      await runBuild(opts);
    });
};
