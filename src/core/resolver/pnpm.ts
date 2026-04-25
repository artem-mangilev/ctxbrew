import { join } from "node:path";
import { readWantedLockfile } from "@pnpm/lockfile-file";

const inferPackageName = (depPath: string, info: { name?: string } | undefined): string | null => {
  if (info?.name) return info.name;
  const cleaned = depPath.replace(/^\//, "");
  const scoped = cleaned.match(/^(@[^/]+\/[^@/]+)@/);
  if (scoped) return scoped[1];
  const unscoped = cleaned.match(/^([^/@]+)@/);
  return unscoped?.[1] ?? null;
};

const depPathToPnpmFolder = (depPath: string): string => depPath.replace(/^\//, "").replace(/\//g, "+");

const discoverByGlob = async (cwd: string): Promise<string[]> => {
  const patterns = [
    "node_modules/.pnpm/*/node_modules/*/ctxbrew/index.yaml",
    "node_modules/.pnpm/*/node_modules/@*/*/ctxbrew/index.yaml",
  ];
  const out = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd, onlyFiles: true, dot: true })) {
      out.add(join(cwd, rel));
    }
  }
  return [...out];
};

export const discoverPnpmIndexPaths = async (cwd: string): Promise<string[]> => {
  const lockFile = Bun.file(join(cwd, "pnpm-lock.yaml"));
  if (!(await lockFile.exists())) {
    return [];
  }
  const out = new Set<string>();
  const lockfile = await readWantedLockfile(cwd, { ignoreIncompatible: true });
  for (const [depPath, info] of Object.entries(lockfile?.packages ?? {})) {
    const packageName = inferPackageName(depPath, info);
    if (!packageName) continue;
    const indexPath = join(
      cwd,
      "node_modules/.pnpm",
      depPathToPnpmFolder(depPath),
      "node_modules",
      ...packageName.split("/"),
      "ctxbrew/index.yaml",
    );
    if (await Bun.file(indexPath).exists()) {
      out.add(indexPath);
    }
  }
  for (const path of await discoverByGlob(cwd)) out.add(path);
  return [...out];
};
