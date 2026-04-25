import { Command } from "commander";
import { registerGetCommand } from "./get.ts";
import { registerInitCommand } from "./init.ts";
import { registerListCommand } from "./list.ts";
import { registerSearchCommand } from "./search.ts";
import { registerSetupCommand } from "./setup.ts";
import { registerSkillCommand } from "./skill.ts";
import { CtxbrewError, ExitCode } from "../utils/exit.ts";
import { logger } from "../utils/logger.ts";

export const buildProgram = (toolVersion: string): Command => {
  const program = new Command();
  program
    .name("ctxbrew")
    .description(
      "Package and read AI context slices from npm dependencies.",
    )
    .version(toolVersion, "-V, --version", "print ctxbrew version")
    .showHelpAfterError(true)
    .configureOutput({
      writeErr: (s) => process.stderr.write(s),
    });

  registerInitCommand(program);
  program
    .command("build")
    .description("Build ctxbrew artifacts (`ctxbrew/*.md` and `ctxbrew/index.yaml`)")
    .option("--check", "validate config and inputs only, do not write files")
    .option("--cwd <dir>", "project root (defaults to current directory)")
    .action(async (opts: { check?: boolean; cwd?: string }) => {
      const { runBuild } = await import("./build.ts");
      await runBuild(opts);
    });
  registerListCommand(program);
  registerGetCommand(program);
  registerSearchCommand(program);
  registerSetupCommand(program);
  registerSkillCommand(program);

  return program;
};

export const runCli = async (toolVersion: string, argv: string[]): Promise<number> => {
  const program = buildProgram(toolVersion);
  try {
    await program.parseAsync(argv, { from: "user" });
    return ExitCode.OK;
  } catch (err) {
    if (err instanceof CtxbrewError) {
      logger.error(err.message, err.hint);
      return err.code;
    }
    if (err instanceof Error) {
      logger.error(err.message);
      return ExitCode.USAGE;
    }
    logger.error(String(err));
    return ExitCode.USAGE;
  }
};
