import { Command } from "commander";
import { registerCacheCommand } from "./cache.ts";
import { registerCompletionCommand } from "./completion.ts";
import { registerGetCommand } from "./get.ts";
import { registerInfoCommand } from "./info.ts";
import { registerInitCommand } from "./init.ts";
import { registerInstallCommand } from "./install.ts";
import { registerListCommand } from "./list.ts";
import { registerPublishCommand } from "./publish.ts";
import { CtxbrewError, ExitCode } from "../utils/exit.ts";
import { logger } from "../utils/logger.ts";

export const buildProgram = (toolVersion: string): Command => {
  const program = new Command();
  program
    .name("ctxb")
    .description(
      "Pack docs/source into versioned context bundles for AI agents.",
    )
    // enablePositionalOptions scopes --version to its position: `ctxb --version`
    // returns the tool version, `ctxb publish --version 1.0.0` is the publish flag.
    .enablePositionalOptions(true)
    .version(toolVersion, "-V, --version", "print ctxb version")
    .showHelpAfterError(true)
    .configureOutput({
      writeErr: (s) => process.stderr.write(s),
    });

  registerInitCommand(program);
  registerPublishCommand(program);
  registerInstallCommand(program);
  registerListCommand(program);
  registerInfoCommand(program);
  registerCacheCommand(program);
  registerGetCommand(program);
  registerCompletionCommand(program);

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
