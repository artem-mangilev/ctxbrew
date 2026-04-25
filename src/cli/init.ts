import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CURRENT_PROTOCOL_VERSION } from "../core/protocol.ts";
import { configError } from "../utils/exit.ts";
import { logger } from "../utils/logger.ts";
import { stringifyYaml } from "../core/yaml.ts";

type Options = {
  cwd?: string;
  force?: boolean;
};

const ensureGitattributesEntry = async (cwd: string, entry: string): Promise<void> => {
  const target = join(cwd, ".gitattributes");
  let current = "";
  const file = Bun.file(target);
  if (await file.exists()) {
    current = await readFile(target, "utf8");
    if (current.split(/\r?\n/).map((line) => line.trim()).includes(entry)) return;
  }
  const base = current.length > 0 && !current.endsWith("\n") ? `${current}\n` : current;
  await Bun.write(target, `${base}${entry}\n`);
};

const INIT_CONFIG_TEMPLATE = stringifyYaml({
  version: CURRENT_PROTOCOL_VERSION,
  slices: [
    {
      id: "overview",
      description: "High-level architecture and usage",
      include: ["README.md"],
    },
  ],
});

export const runInit = async (opts: Options): Promise<void> => {
  const cwd = opts.cwd ?? process.cwd();
  const packageJsonPath = join(cwd, "package.json");
  const packageJsonFile = Bun.file(packageJsonPath);
  if (!(await packageJsonFile.exists())) {
    throw configError(
      `package.json not found at ${packageJsonPath}`,
      "Run `npm init -y` first, then run `ctxbrew init`.",
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = await packageJsonFile.json();
  } catch (e) {
    throw configError(
      `Invalid JSON in ${packageJsonPath}: ${(e as Error).message}`,
      "Fix package.json and retry.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw configError(`package.json at ${packageJsonPath} must be a JSON object`);
  }

  const currentFiles = (parsed as { files?: unknown }).files;
  let nextFiles: string[] | undefined;
  if (currentFiles === undefined) {
    nextFiles = ["dist", "ctxbrew", "AGENTS.md"];
  } else if (Array.isArray(currentFiles) && currentFiles.every((item) => typeof item === "string")) {
    nextFiles = [...new Set([...currentFiles, "ctxbrew", "AGENTS.md"])];
  } else {
    throw configError(
      `package.json field "files" must be an array of strings at ${packageJsonPath}`,
      'Fix package.json or remove "files" and retry.',
    );
  }

  const scriptsRaw = (parsed as { scripts?: unknown }).scripts;
  let nextScripts: Record<string, string>;
  if (scriptsRaw === undefined) {
    nextScripts = { prepack: "ctxbrew build" };
  } else if (
    typeof scriptsRaw === "object" &&
    scriptsRaw !== null &&
    !Array.isArray(scriptsRaw) &&
    Object.values(scriptsRaw).every((value) => typeof value === "string")
  ) {
    nextScripts = { ...(scriptsRaw as Record<string, string>) };
    const prepack = nextScripts.prepack;
    if (!prepack) {
      nextScripts.prepack = "ctxbrew build";
    } else if (!prepack.includes("ctxbrew build")) {
      if (!opts.force) {
        throw configError(
          'package.json scripts.prepack exists but does not include "ctxbrew build"',
          "Use --force to prepend ctxbrew build to prepack automatically.",
        );
      }
      nextScripts.prepack = `ctxbrew build && ${prepack}`;
    }
  } else {
    throw configError(
      `package.json field "scripts" must be an object of string commands at ${packageJsonPath}`,
    );
  }

  const next = { ...parsed, files: nextFiles, scripts: nextScripts };
  await Bun.write(packageJsonPath, `${JSON.stringify(next, null, 2)}\n`);
  const configPath = join(cwd, "ctxbrew.yaml");
  const configExists = await Bun.file(configPath).exists();
  if (!configExists || opts.force) {
    await Bun.write(configPath, INIT_CONFIG_TEMPLATE);
  }
  await ensureGitattributesEntry(cwd, "ctxbrew/** linguist-generated=true");
  logger.success(`updated ${packageJsonPath} and ctxbrew.yaml`);
  logger.info("Added package files, scripts.prepack, ctxbrew.yaml and .gitattributes entry.");
};

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .description("Create/update ctxbrew.yaml and publish integration")
    .option("--cwd <dir>", "directory to write into (defaults to current directory)")
    .option("--force", "overwrite config files when needed")
    .action(async (opts: Options) => {
      await runInit(opts);
    });
};
