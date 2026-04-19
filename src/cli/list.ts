import { Command } from "commander";
import { getRegistry } from "../registry/factory.ts";
import { colorize } from "../utils/logger.ts";

type Options = {
  json?: boolean;
};

export const runList = async (opts: Options): Promise<void> => {
  const registry = getRegistry();
  const entries = await registry.list();
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return;
  }
  if (entries.length === 0) {
    process.stdout.write("(no packages in registry)\n");
    return;
  }
  for (const e of entries) {
    process.stdout.write(
      `${colorize.bold(e.name)}  latest=${e.latest ?? "?"}  versions=${e.versions.join(", ")}\n`,
    );
  }
};

export const registerListCommand = (program: Command): void => {
  program
    .command("list")
    .description("List packages and versions in the local registry")
    .option("--json", "output as JSON")
    .action(async (opts: Options) => {
      await runList(opts);
    });
};
