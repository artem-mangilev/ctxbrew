import { Command } from "commander";
import { ensureCached } from "../cache/cache.ts";
import { getRegistry } from "../registry/factory.ts";
import { usageError } from "../utils/exit.ts";
import { colorize, logger } from "../utils/logger.ts";

const parseSpec = (spec: string): { name: string; range: string } => {
  if (!spec || spec.startsWith("@")) {
    throw usageError(`Invalid package spec "${spec}"`, "Use <name>[@<range>], e.g. react@19 or react.");
  }
  const idx = spec.lastIndexOf("@");
  if (idx <= 0) return { name: spec, range: "latest" };
  return { name: spec.slice(0, idx), range: spec.slice(idx + 1) || "latest" };
};

type Options = {
  noCache?: boolean;
};

export const runInstall = async (spec: string, opts: Options): Promise<void> => {
  const { name, range } = parseSpec(spec);
  const registry = getRegistry();
  const version = await registry.resolveVersion(name, range);
  const manifest = await registry.fetchManifest(name, version);
  const dir = await ensureCached(registry, manifest, { noCache: opts.noCache });
  logger.success(
    `installed ${colorize.bold(`${name}@${version}`)} -> ${dir} (${Object.keys(manifest.sections).length} sections)`,
  );
};

export const registerInstallCommand = (program: Command): void => {
  program
    .command("install <spec>")
    .description("Download a package into the local cache (e.g. react or react@19.0.0)")
    .option("--no-cache", "force re-fetch even if cached")
    .action(async (spec: string, opts: Options) => {
      await runInstall(spec, opts);
    });
};
