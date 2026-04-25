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

export const withCwd = async <T>(cwd: string, fn: () => Promise<T>): Promise<T> => {
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
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

export const captureStdout = async (fn: () => Promise<void>): Promise<string> => {
  const original = process.stdout.write.bind(process.stdout);
  let buf = "";
  (process.stdout as unknown as { write: (s: unknown) => boolean }).write = (s: unknown) => {
    buf += typeof s === "string" ? s : new TextDecoder().decode(s as Uint8Array);
    return true;
  };
  try {
    await fn();
  } finally {
    (process.stdout as unknown as { write: (s: unknown) => boolean }).write = original as unknown as (s: unknown) => boolean;
  }
  return buf;
};

export const captureStderr = async (fn: () => Promise<void>): Promise<string> => {
  const original = process.stderr.write.bind(process.stderr);
  let buf = "";
  (process.stderr as unknown as { write: (s: unknown) => boolean }).write = (s: unknown) => {
    buf += typeof s === "string" ? s : new TextDecoder().decode(s as Uint8Array);
    return true;
  };
  try {
    await fn();
  } finally {
    (process.stderr as unknown as { write: (s: unknown) => boolean }).write =
      original as unknown as (s: unknown) => boolean;
  }
  return buf;
};
