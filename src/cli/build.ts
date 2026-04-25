import { Command } from "commander";
import { buildCtxbrewArtifacts } from "../core/builder.ts";
import { colorize, logger } from "../utils/logger.ts";

type Options = {
  check?: boolean;
  cwd?: string;
};

export const runBuild = async (opts: Options): Promise<void> => {
  const cwd = opts.cwd ?? process.cwd();
  const result = await buildCtxbrewArtifacts(cwd, { checkOnly: opts.check });
  logger.info(`using ${result.configPath}`);
  for (const slice of result.slices) {
    logger.info(`  - ${colorize.bold(slice.id)} (${slice.matchedFiles.length} files)`);
  }
  if (opts.check) {
    logger.success(`validated ${result.slices.length} slices`);
    return;
  }
  logger.success(`built ${result.slices.length} slices into ${colorize.bold("ctxbrew/")}`);
};

export const registerBuildCommand = (program: Command): void => {
  program
    .command("build")
    .description("Build ctxbrew artifacts (`ctxbrew/*.md` and `ctxbrew/index.yaml`)")
    .option("--check", "validate config and inputs only, do not write files")
    .option("--cwd <dir>", "project root (defaults to current directory)")
    .action(async (opts: Options) => {
      await runBuild(opts);
    });
};
