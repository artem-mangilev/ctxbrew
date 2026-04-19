import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import { configError } from "../utils/exit.ts";

export type CollectInput = {
  root: string;
  patterns: string[];
};

const stripLeadingDotSlash = (p: string): string =>
  p.startsWith("./") ? p.slice(2) : p.startsWith(".\\") ? p.slice(2) : p;

const splitPatterns = (patterns: string[]): { include: string[]; exclude: string[] } => {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const raw of patterns) {
    const p = stripLeadingDotSlash(raw);
    if (p.startsWith("!")) {
      exclude.push(stripLeadingDotSlash(p.slice(1)));
    } else {
      include.push(p);
    }
  }
  return { include, exclude };
};

const assertSafePattern = (pattern: string): void => {
  if (isAbsolute(pattern)) {
    throw configError(
      `Glob pattern must be relative to repo root: "${pattern}"`,
      "Remove the leading slash or absolute drive letter.",
    );
  }
  const normalized = normalize(pattern);
  if (
    normalized === ".." ||
    normalized.startsWith(`..${sep}`) ||
    normalized.includes(`${sep}..${sep}`) ||
    normalized.endsWith(`${sep}..`)
  ) {
    throw configError(
      `Glob pattern must not escape repo root with "..": "${pattern}"`,
    );
  }
};

const assertWithinRoot = (root: string, fileAbs: string): void => {
  const rel = relative(root, fileAbs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw configError(
      `Resolved file "${fileAbs}" is outside repo root "${root}". Symlink or pattern is unsafe.`,
    );
  }
};

export const collectFiles = async ({ root, patterns }: CollectInput): Promise<string[]> => {
  const { include, exclude } = splitPatterns(patterns);
  for (const p of [...include, ...exclude]) assertSafePattern(p);

  const matched = new Set<string>();
  for (const inc of include) {
    const glob = new Bun.Glob(inc);
    for await (const rel of glob.scan({ cwd: root, onlyFiles: true, dot: false })) {
      const abs = resolve(root, rel);
      assertWithinRoot(root, abs);
      matched.add(rel);
    }
  }
  if (exclude.length > 0) {
    const excludeGlobs = exclude.map((p) => new Bun.Glob(p));
    for (const file of [...matched]) {
      if (excludeGlobs.some((g) => g.match(file))) matched.delete(file);
    }
  }

  return [...matched].sort();
};
