import { Command } from "commander";
import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { renderClaudeSkill } from "../agents/claude.ts";
import { renderAgentsSkill } from "../agents/agents-md.ts";
import { logger } from "../utils/logger.ts";

type SetupTarget = {
  path: string;
  content: string;
};

type Options = {
  cwd?: string;
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const resolveRepoRoot = async (cwd: string): Promise<string> => {
  let cursor = cwd;
  while (true) {
    if (await pathExists(join(cursor, ".git"))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      return cwd;
    }
    cursor = parent;
  }
};

const setupTargets = (root: string): SetupTarget[] => {
  return [
    {
      path: join(root, ".claude/skills/ctxbrew/SKILL.md"),
      content: renderClaudeSkill(),
    },
    {
      path: join(root, ".agents/skills/ctxbrew/SKILL.md"),
      content: renderAgentsSkill(),
    },
  ];
};

export const runSetup = async (opts: Options = {}): Promise<void> => {
  const root = await resolveRepoRoot(opts.cwd ?? process.cwd());
  for (const target of setupTargets(root)) {
    await mkdir(dirname(target.path), { recursive: true });
    await Bun.write(target.path, target.content);
    logger.success(`wrote ${target.path}`);
  }
};

export const registerSetupCommand = (program: Command): void => {
  program
    .command("setup")
    .description("Install ctxbrew skills for supported agents")
    .option("--cwd <dir>", "directory inside target repository (defaults to current directory)")
    .action(async (opts: Options) => {
      await runSetup(opts);
    });
};
