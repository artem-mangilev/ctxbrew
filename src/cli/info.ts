import { Command } from "commander";
import { LocalFsRegistry } from "../registry/localFs.ts";
import { colorize } from "../utils/logger.ts";

type Options = {
  version?: string;
  json?: boolean;
};

export const runInfo = async (name: string, opts: Options): Promise<void> => {
  const registry = new LocalFsRegistry();
  const range = opts.version ?? "latest";
  const version = await registry.resolveVersion(name, range);
  const manifest = await registry.fetchManifest(name, version);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  const lines = [
    `${colorize.bold(manifest.name)}@${manifest.version}`,
    `  registry:    ${registry.describe()}`,
    `  publishedAt: ${manifest.publishedAt}`,
    `  payload:     ${manifest.payload.bytes} bytes  sha256:${manifest.payload.sha256.slice(0, 16)}…`,
    `  sections:`,
  ];
  for (const [section, body] of Object.entries(manifest.sections)) {
    lines.push(`    - ${section}: ${body.files.length} file(s)`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
};

export const registerInfoCommand = (program: Command): void => {
  program
    .command("info <name>")
    .description("Show metadata for a package in the registry")
    .option("--version <range>", "version range (default: latest)")
    .option("--json", "output as JSON")
    .action(async (name: string, opts: Options) => {
      await runInfo(name, opts);
    });
};
