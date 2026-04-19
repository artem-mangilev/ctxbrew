import { Command } from "commander";
import { join } from "node:path";
import { configError } from "../utils/exit.ts";
import { logger } from "../utils/logger.ts";

const TEMPLATE = {
  name: "my-library",
  version: "0.1.0",
  cli: {
    docs: "./docs/**/*.md",
    api: ["./src/**/*.ts", "!**/*.test.ts"],
  },
};

type Options = {
  cwd?: string;
  force?: boolean;
};

export const runInit = async (opts: Options): Promise<void> => {
  const cwd = opts.cwd ?? process.cwd();
  const target = join(cwd, "ctxbrew.config.json");
  const file = Bun.file(target);
  if ((await file.exists()) && !opts.force) {
    throw configError(
      `ctxbrew.config.json already exists at ${target}`,
      "Pass --force to overwrite.",
    );
  }
  await Bun.write(target, `${JSON.stringify(TEMPLATE, null, 2)}\n`);
  logger.success(`wrote ${target}`);
  logger.info("Edit `name`, `version`, and `cli` sections, then run `ctxb publish`.");
};

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .description("Create a starter ctxbrew.config.json in the current directory")
    .option("--cwd <dir>", "directory to write into (defaults to current directory)")
    .option("--force", "overwrite existing ctxbrew.config.json")
    .action(async (opts: Options) => {
      await runInit(opts);
    });
};
