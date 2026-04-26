import { Command } from "commander";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";

type Options = {
  cwd?: string;
  force?: boolean;
};

const INIT_CONFIG_TEMPLATE = [
  "version: 1",
  "slices:",
  "  - id: overview",
  "    description: High-level architecture",
  "    include:",
  "      - README.md",
  "",
].join("\n");

export const runInit = async (opts: Options): Promise<void> => {
  const cwd = opts.cwd ?? process.cwd();
  const configPath = join(cwd, "ctxbrew.yaml");
  const configExists = await Bun.file(configPath).exists();
  if (!configExists || opts.force) {
    await Bun.write(configPath, INIT_CONFIG_TEMPLATE);
  }
  logger.success(`updated ${configPath}`);
  logger.info("Created ctxbrew.yaml.");
};

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .description("Create/update ctxbrew.yaml")
    .option("--cwd <dir>", "directory to write into (defaults to current directory)")
    .option("--force", "overwrite config files when needed")
    .action(async (opts: Options) => {
      await runInit(opts);
    });
};
