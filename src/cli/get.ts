import { Command } from "commander";
import { render, type RenderFormat } from "../extract/render.ts";
import { readManifest, readSectionFile } from "../registry/nodeModules.ts";
import { notFoundError, usageError } from "../utils/exit.ts";
import { colorize } from "../utils/logger.ts";

type Options = {
  json?: boolean;
  filesOnly?: boolean;
  maxBytes?: string;
  grep?: string;
};

const resolveFormat = (opts: Options): RenderFormat => {
  if (opts.json && opts.filesOnly) {
    throw usageError("--json and --files-only are mutually exclusive");
  }
  if (opts.json) return "json";
  if (opts.filesOnly) return "files-only";
  return "markdown";
};

const parseMaxBytes = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d+)\s*([kmg]?b?)?$/i);
  if (!m) throw usageError(`Invalid --max-bytes value "${raw}"`, "Use a number, optionally suffixed with k/m/g.");
  const n = Number(m[1]);
  const mult = ((): number => {
    const u = (m[2] ?? "").toLowerCase();
    if (u.startsWith("g")) return 1024 ** 3;
    if (u.startsWith("m")) return 1024 ** 2;
    if (u.startsWith("k")) return 1024;
    return 1;
  })();
  return n * mult;
};

export const runGet = async (
  name: string,
  section: string | undefined,
  opts: Options,
): Promise<void> => {
  const cwd = process.cwd();
  const manifest = await readManifest(name, cwd);

  if (!section) {
    const sections = Object.keys(manifest.sections).sort();
    if (sections.length === 0) {
      process.stdout.write(`(no sections in ${manifest.name}@${manifest.version})\n`);
      return;
    }
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            name: manifest.name,
            version: manifest.version,
            sections: Object.fromEntries(
              sections.map((s) => [s, { files: manifest.sections[s].files.length }]),
            ),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    process.stdout.write(`${colorize.bold(manifest.name)}@${manifest.version}\n`);
    for (const s of sections) {
      process.stdout.write(`  ${s}  (${manifest.sections[s].files.length} files)\n`);
    }
    return;
  }

  const sectionMeta = manifest.sections[section];
  if (!sectionMeta) {
    const available = Object.keys(manifest.sections).sort().join(", ");
    throw notFoundError(
      `Section "${section}" not found in ${manifest.name}@${manifest.version}`,
      `Available sections: ${available}`,
    );
  }

  let filePaths = [...sectionMeta.files];
  if (opts.grep) {
    let re: RegExp;
    try {
      re = new RegExp(opts.grep);
    } catch (e) {
      throw usageError(`Invalid --grep regex: ${(e as Error).message}`);
    }
    filePaths = filePaths.filter((p) => re.test(p));
  }

  const files = await Promise.all(
    filePaths.map(async (path) => ({ path, content: await readSectionFile(name, cwd, path) })),
  );
  const format = resolveFormat(opts);
  const result = render(files, {
    format,
    packageName: manifest.name,
    version: manifest.version,
    section,
    maxBytes: parseMaxBytes(opts.maxBytes),
  });
  process.stdout.write(result.output);
  if (result.truncated) {
    process.stderr.write(
      `warn truncated: emitted ${result.filesIncluded}/${files.length} files due to --max-bytes\n`,
    );
  }
};

export const registerGetCommand = (program: Command): void => {
  program
    .command("get <name> [section]")
    .description("Read section from an installed package's .ctxbrew metadata")
    .option("--json", "emit JSON instead of markdown")
    .option("--files-only", "emit just the matched file paths, one per line")
    .option("--max-bytes <n>", "cap output size (e.g. 200k, 5m)")
    .option("--grep <regex>", "filter files by path regex")
    .action(async (name: string, section: string | undefined, opts: Options) => {
      await runGet(name, section, opts);
    });
};
