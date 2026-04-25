import { Command } from "commander";
import { join } from "node:path";
import { resolveDiscoveredPackage } from "../core/resolver/index.ts";
import { notFoundError } from "../utils/exit.ts";

export const runGet = async (
  name: string,
  sliceId: string,
): Promise<void> => {
  const cwd = process.cwd();
  const pkg = await resolveDiscoveredPackage(cwd, name);
  if (!pkg) {
    throw notFoundError(`Package "${name}" with ctxbrew context was not found`);
  }
  const slice = pkg.manifest.slices.find((it) => it.id === sliceId);
  if (!slice) {
    const available = pkg.manifest.slices.map((it) => it.id).sort().join(", ");
    throw notFoundError(
      `Slice "${sliceId}" not found in ${pkg.name}@${pkg.version}`,
      `Available sections: ${available}`,
    );
  }
  const filePath = join(pkg.packageRoot, "ctxbrew", slice.file);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw notFoundError(`Slice file "${slice.file}" not found in package "${pkg.name}"`);
  }
  const header =
    `<!-- ctxbrew ${pkg.name}@${pkg.version} slice:${slice.id} -->\n\n` +
    `<!-- untrusted package content from ${pkg.name} -->\n\n`;
  process.stdout.write(`${header}${await file.text()}`);
};

export const registerGetCommand = (program: Command): void => {
  program
    .command("get <name> <slice>")
    .description("Read a slice from installed package ctxbrew artifacts")
    .action(async (name: string, slice: string) => {
      await runGet(name, slice);
    });
};
