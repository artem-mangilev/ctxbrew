import { join } from "node:path";

type BunLock = {
  workspaces?: Record<string, {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  }>;
  packages?: Record<string, unknown>;
};

const collectLockPackageNames = async (cwd: string): Promise<Set<string>> => {
  const lock = (await Bun.file(join(cwd, "bun.lock")).json()) as BunLock;
  const names = new Set<string>();
  for (const workspace of Object.values(lock.workspaces ?? {})) {
    for (const deps of [
      workspace.dependencies,
      workspace.devDependencies,
      workspace.optionalDependencies,
    ]) {
      for (const name of Object.keys(deps ?? {})) names.add(name);
    }
  }
  for (const name of Object.keys(lock.packages ?? {})) {
    names.add(name);
  }
  return names;
};

const discoverByGlob = async (cwd: string): Promise<string[]> => {
  const patterns = [
    "node_modules/*/ctxbrew/index.yaml",
    "node_modules/@*/*/ctxbrew/index.yaml",
  ];
  const out = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd, onlyFiles: true, dot: false })) {
      out.add(join(cwd, rel));
    }
  }
  return [...out];
};

export const discoverBunIndexPaths = async (cwd: string): Promise<string[]> => {
  const lockFile = Bun.file(join(cwd, "bun.lock"));
  if (!(await lockFile.exists())) {
    return [];
  }
  const out = new Set<string>();
  const names = await collectLockPackageNames(cwd);
  for (const name of names) {
    const indexPath = join(cwd, "node_modules", ...name.split("/"), "ctxbrew/index.yaml");
    if (await Bun.file(indexPath).exists()) {
      out.add(indexPath);
    }
  }
  for (const path of await discoverByGlob(cwd)) out.add(path);
  return [...out];
};
