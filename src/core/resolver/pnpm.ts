import { join } from "node:path";

export const discoverPnpmIndexPaths = async (cwd: string): Promise<string[]> => {
  const lockFile = Bun.file(join(cwd, "pnpm-lock.yaml"));
  if (!(await lockFile.exists())) {
    return [];
  }
  const patterns = [
    "node_modules/.pnpm/*/node_modules/*/ctxbrew/index.yaml",
    "node_modules/.pnpm/*/node_modules/@*/*/ctxbrew/index.yaml",
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
