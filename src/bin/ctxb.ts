#!/usr/bin/env bun
import pkg from "../../package.json" with { type: "json" };
import { runCli } from "../cli/index.ts";

const main = async (): Promise<void> => {
  const code = await runCli(pkg.version, process.argv.slice(2));
  process.exit(code);
};

main().catch((err) => {
  process.stderr.write(`fatal ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
