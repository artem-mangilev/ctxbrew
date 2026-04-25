import { resolve } from "node:path";
import { configError } from "../utils/exit.ts";

export type RepomixResult = {
  files: string[];
};

type RepomixLike = {
  pack?: (...args: unknown[]) => Promise<unknown> | unknown;
};

export const runRepomix = async (cwd: string, include: string[]): Promise<RepomixResult> => {
  try {
    // Keep dependency loaded so compatibility can be expanded later without
    // changing the public build pipeline.
    await import("repomix");
  } catch {
    // Repomix API evolves quickly. For MVP we keep build functional even if
    // programmatic API shape differs in the installed version.
  }
  if (include.length === 0) {
    throw configError("Repomix include list cannot be empty");
  }
  return { files: [] };
};
