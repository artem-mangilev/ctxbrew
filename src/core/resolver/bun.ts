import { join } from "node:path";

export const discoverBunIndexPaths = async (cwd: string): Promise<string[]> => {
  const lockFile = Bun.file(join(cwd, "bun.lock"));
  if (!(await lockFile.exists())) {
    return [];
  }
  // Bun installs still live in node_modules; keep this as a dedicated provider
  // so resolver pipeline can prioritize/extend providers independently.
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
