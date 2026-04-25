import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildCliConfig,
  loadFileConfig,
  mergeConfigs,
  pack,
  setLogLevel,
} from "repomix";
import { configError } from "../utils/exit.ts";

export type RepomixResult = {
  files: string[];
  content: string;
};

export const runRepomix = async (
  cwd: string,
  include: string[],
  ignoredPaths: string[] = [],
): Promise<RepomixResult> => {
  if (include.length === 0) {
    throw configError("Repomix include list cannot be empty");
  }
  const workDir = await mkdtemp(join(tmpdir(), "ctxbrew-repomix-"));
  const outPath = join(workDir, "slice.md");
  try {
    setLogLevel(-1);
    const fileConfig = await loadFileConfig(cwd, null);
    const cliConfig = buildCliConfig({
      output: outPath,
      style: "markdown",
      include: include.join(","),
      ignore: ignoredPaths.join(","),
      compress: true,
      fileSummary: true,
      directoryStructure: true,
      files: true,
      copy: false,
      securityCheck: true,
    });
    const config = mergeConfigs(cwd, fileConfig, cliConfig);
    const result = await pack([resolve(cwd)], config);
    const outputFile = Bun.file(outPath);
    const content = await outputFile.text();
    if (result.suspiciousFilesResults.length > 0) {
      const files = result.suspiciousFilesResults.map((item) => item.filePath).join(", ");
      throw configError(`Potential prompt-injection pattern found by Repomix in: ${files}`);
    }
    return {
      files: result.safeFilePaths,
      content,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};
