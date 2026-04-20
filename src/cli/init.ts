import { Command } from "commander";
import { readFile } from "node:fs/promises";
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

const ensureGitignoreEntry = async (cwd: string, entry: string): Promise<void> => {
  const target = join(cwd, ".gitignore");
  let current = "";
  const file = Bun.file(target);
  if (await file.exists()) {
    current = await readFile(target, "utf8");
    const hasEntry = current
      .split(/\r?\n/)
      .map((line) => line.trim())
      .includes(entry);
    if (hasEntry) return;
  }
  const base = current.length > 0 && !current.endsWith("\n") ? `${current}\n` : current;
  await Bun.write(target, `${base}${entry}\n`);
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

  const currentFiles = (parsed as { files?: unknown }).files;
  let nextFiles: string[] | undefined;
  if (currentFiles === undefined) {
    nextFiles = [".ctxbrew"];
  } else if (Array.isArray(currentFiles) && currentFiles.every((item) => typeof item === "string")) {
    nextFiles = currentFiles.includes(".ctxbrew") ? currentFiles : [...currentFiles, ".ctxbrew"];
  } else {
    throw configError(
      `package.json field "files" must be an array of strings at ${target}`,
      'Fix package.json or remove "files" and retry.',
    );
  }

  const scriptsRaw = (parsed as { scripts?: unknown }).scripts;
  let nextScripts: Record<string, string>;
  if (scriptsRaw === undefined) {
    nextScripts = { prepack: "ctxb publish" };
  } else if (
    typeof scriptsRaw === "object" &&
    scriptsRaw !== null &&
    !Array.isArray(scriptsRaw) &&
    Object.values(scriptsRaw).every((value) => typeof value === "string")
  ) {
    nextScripts = { ...(scriptsRaw as Record<string, string>) };
    const prepack = nextScripts.prepack;
    if (!prepack) {
      nextScripts.prepack = "ctxb publish";
    } else if (!prepack.includes("ctxb publish")) {
      if (!opts.force) {
        throw configError(
          'package.json scripts.prepack exists but does not include "ctxb publish"',
          "Use --force to prepend ctxb publish to prepack automatically.",
        );
      }
      nextScripts.prepack = `ctxb publish && ${prepack}`;
    }
  } else {
    throw configError(
      `package.json field "scripts" must be an object of string commands at ${target}`,
    );
  }

  const next = { ...parsed, ctxbrew: TEMPLATE, files: nextFiles, scripts: nextScripts };
  await Bun.write(target, `${JSON.stringify(next, null, 2)}\n`);
  await ensureGitignoreEntry(cwd, ".ctxbrew/");
  logger.success(`updated ${target} with package.json#ctxbrew`);
  logger.info("Added package.json files/.ctxbrew, scripts.prepack=ctxb publish and .gitignore entry.");
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
