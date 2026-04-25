import { Command } from "commander";
import Fuse from "fuse.js";
import { discoverCtxbrewPackages } from "../core/resolver/index.ts";

type SearchRow = {
  pkg: string;
  id: string;
  description: string;
};

type Options = {
  limit?: string;
};

const parseLimit = (raw: string | undefined): number => {
  if (!raw) return 10;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return 10;
  return value;
};

export const runSearch = async (query: string, opts: Options): Promise<void> => {
  const packages = await discoverCtxbrewPackages(process.cwd());
  const rows: SearchRow[] = [];
  for (const pkg of packages) {
    for (const slice of pkg.manifest.slices) {
      rows.push({ pkg: pkg.name, id: slice.id, description: slice.description });
    }
  }
  if (rows.length === 0) return;
  const fuse = new Fuse(rows, {
    includeScore: true,
    threshold: 0.4,
    keys: [
      { name: "description", weight: 0.7 },
      { name: "id", weight: 0.3 },
    ],
  });
  const limit = parseLimit(opts.limit);
  const matches = fuse.search(query, { limit });
  for (const match of matches) {
    const score = 1 - (match.score ?? 1);
    process.stdout.write(`${match.item.pkg} ${match.item.id} (${score.toFixed(2)})\n`);
  }
};

export const registerSearchCommand = (program: Command): void => {
  program
    .command("search <query>")
    .description("Search available slices by id and description")
    .option("--limit <n>", "result limit (default: 10)")
    .action(async (query: string, opts: Options) => {
      await runSearch(query, opts);
    });
};
