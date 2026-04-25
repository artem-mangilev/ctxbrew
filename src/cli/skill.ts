import { Command } from "commander";
import { usageError } from "../utils/exit.ts";
import { renderClaudeSkill } from "../agents/claude.ts";
import { renderCursorSkill } from "../agents/cursor.ts";
import { renderCopilotSkill } from "../agents/copilot.ts";
import { renderAgentsSkill } from "../agents/agents-md.ts";

type Options = {
  agent?: string;
};

const renderSkillForAgent = (agent: string): string => {
  switch (agent) {
    case "claude":
      return renderClaudeSkill();
    case "cursor":
      return renderCursorSkill();
    case "copilot":
      return renderCopilotSkill();
    case "agents":
      return renderAgentsSkill();
    default:
      throw usageError(`Unknown agent "${agent}"`, "Use one of: claude, cursor, copilot, agents.");
  }
};

export const runSkill = async (opts: Options): Promise<void> => {
  if (!opts.agent) {
    throw usageError("Missing --agent option", "Use --agent claude|cursor|copilot|agents.");
  }
  process.stdout.write(renderSkillForAgent(opts.agent));
};

export const registerSkillCommand = (program: Command): void => {
  program
    .command("skill")
    .description("Render ctxbrew skill markdown for selected agent")
    .requiredOption("--agent <name>", "claude|cursor|copilot|agents")
    .action(async (opts: Options) => {
      await runSkill(opts);
    });
};
