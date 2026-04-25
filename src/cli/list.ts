import { Command } from "commander";
import { discoverCtxbrewPackages } from "../core/resolver/index.ts";
import { colorize } from "../utils/logger.ts";
import { notFoundError } from "../utils/exit.ts";

export const runList = async (packageName?: string): Promise<void> => {
  const packages = await discoverCtxbrewPackages(process.cwd());
  if (packageName) {
    const pkg = packages.find((item) => item.name === packageName);
    if (!pkg) {
      throw notFoundError(`Package "${packageName}" with ctxbrew context was not found`);
    }
    process.stdout.write(`${colorize.bold(pkg.name)}@${pkg.version} (${pkg.manifest.slices.length} slices)\n`);
    for (const slice of pkg.manifest.slices) {
      process.stdout.write(`  ${slice.id} - ${slice.description}\n`);
    }
    return;
  }

  if (packages.length === 0) {
    process.stdout.write("(no packages with ctxbrew metadata found)\n");
    return;
  }
  for (const pkg of packages) {
    const ids = pkg.manifest.slices.map((slice) => slice.id).join(", ");
    process.stdout.write(`${pkg.name}@${pkg.version} (${pkg.manifest.slices.length} slices)\n`);
    process.stdout.write(`  ${ids}\n`);
  }
};

export const registerListCommand = (program: Command): void => {
  program
    .command("list [package]")
    .description("List installed packages or slices from one package")
    .action(async (packageName?: string) => {
      await runList(packageName);
    });
};
