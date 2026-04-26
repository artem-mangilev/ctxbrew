import { Command } from "commander";
import { renderCursorSkill } from "../agents/cursor.ts";

export const runSkill = async (): Promise<void> => {
  process.stdout.write(renderCursorSkill());
};

export const registerSkillCommand = (program: Command): void => {
  program
    .command("skill")
    .description("Render ctxbrew skill markdown")
    .action(async () => {
      await runSkill();
    });
};
