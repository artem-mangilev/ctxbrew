import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { renderClaudeSkill } from "../agents/claude.ts";
import { renderAgentsSkill } from "../agents/agents-md.ts";
import { logger } from "../utils/logger.ts";

type SetupTarget = {
  path: string;
  content: string;
};

const setupTargets = (): SetupTarget[] => {
  const home = homedir();
  return [
    {
      path: join(home, ".claude/skills/ctxbrew/SKILL.md"),
      content: renderClaudeSkill(),
    },
    {
      path: join(home, ".agents/skills/ctxbrew/SKILL.md"),
      content: renderAgentsSkill(),
    },
  ];
};

export const runSetup = async (): Promise<void> => {
  for (const target of setupTargets()) {
    await mkdir(dirname(target.path), { recursive: true });
    await Bun.write(target.path, target.content);
    logger.success(`wrote ${target.path}`);
  }
};

export const registerSetupCommand = (program: Command): void => {
  program
    .command("setup")
    .description("Install ctxbrew skills for supported agents")
    .action(async () => {
      await runSetup();
    });
};
