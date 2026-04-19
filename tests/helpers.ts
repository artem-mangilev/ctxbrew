import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const makeTmpDir = async (prefix = "ctxbrew-test-"): Promise<string> => {
  return mkdtemp(join(tmpdir(), prefix));
};

export const withTmpDir = async <T>(fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await makeTmpDir();
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export const withTmpCtxbrewHome = async <T>(fn: (home: string) => Promise<T>): Promise<T> => {
  const dir = await makeTmpDir("ctxbrew-home-");
  const prev = process.env.CTXBREW_HOME;
  process.env.CTXBREW_HOME = dir;
  try {
    return await fn(dir);
  } finally {
    if (prev === undefined) delete process.env.CTXBREW_HOME;
    else process.env.CTXBREW_HOME = prev;
    await rm(dir, { recursive: true, force: true });
  }
};

export const writeFiles = async (
  root: string,
  files: Record<string, string>,
): Promise<void> => {
  for (const [rel, content] of Object.entries(files)) {
    await Bun.write(join(root, rel), content);
  }
};
