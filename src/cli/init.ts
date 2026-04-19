import { Command } from "commander";
import { join } from "node:path";
import { configError } from "../utils/exit.ts";
import { logger } from "../utils/logger.ts";

const TEMPLATE = {
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
  const target = join(cwd, "package.json");
  const file = Bun.file(target);
  if (!(await file.exists())) {
    throw configError(
      `package.json not found at ${target}`,
      "Run `npm init -y` first, then run `ctxb init`.",
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = await file.json();
  } catch (e) {
    throw configError(
      `Invalid JSON in ${target}: ${(e as Error).message}`,
      "Fix package.json and retry.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw configError(`package.json at ${target} must be a JSON object`);
  }
  if ("ctxbrew" in parsed && !opts.force) {
    throw configError(
      `package.json already has a ctxbrew field at ${target}`,
      "Pass --force to overwrite package.json#ctxbrew.",
    );
  }
  const next = { ...parsed, ctxbrew: TEMPLATE };
  await Bun.write(target, `${JSON.stringify(next, null, 2)}\n`);
  logger.success(`updated ${target} with package.json#ctxbrew`);
  logger.info("Edit `ctxbrew.cli` patterns, then run `ctxb publish`.");
};

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .description("Create/update a starter package.json#ctxbrew in the current directory")
    .option("--cwd <dir>", "directory to write into (defaults to current directory)")
    .option("--force", "overwrite existing package.json#ctxbrew")
    .action(async (opts: Options) => {
      await runInit(opts);
    });
};
