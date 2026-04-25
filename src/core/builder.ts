import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadCtxbrewConfig, titleFromId, type CtxbrewSlice } from "./config.ts";
import { renderFrontmatter } from "./frontmatter.ts";
import { type IndexManifest, serializeIndexManifest } from "./index-manifest.ts";
import { packSlice } from "./packer.ts";
import { CURRENT_PROTOCOL_VERSION } from "./protocol.ts";
import { assertNoPromptInjection, validateConfigForBuild } from "./validator.ts";
import { configError } from "../utils/exit.ts";

export type BuildResult = {
  slices: Array<{ id: string; file: string; matchedFiles: string[]; content: string }>;
  configPath: string;
};

const collectMatches = async (cwd: string, patterns: string[]): Promise<string[]> => {
  const out = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd, onlyFiles: true, dot: false })) {
      out.add(rel);
    }
  }
  return [...out].sort();
};

const scanFilesForPromptInjection = async (cwd: string, files: string[]): Promise<void> => {
  for (const relPath of files) {
    const text = await Bun.file(join(cwd, relPath)).text();
    assertNoPromptInjection(relPath, text);
  }
};

const renderSliceBody = (slice: CtxbrewSlice, packedContent: string): string => {
  const title = slice.title ?? titleFromId(slice.id);
  const frontmatter = renderFrontmatter({
    id: slice.id,
    title,
    description: slice.description,
  });
  return `${frontmatter}\n# ${title}\n\n${packedContent.trim()}\n`;
};

export const buildCtxbrewArtifacts = async (
  cwd: string,
  opts: { checkOnly?: boolean } = {},
): Promise<BuildResult> => {
  const { config, configPath } = await loadCtxbrewConfig(cwd);
  validateConfigForBuild(config);

  const used = new Set<string>();
  const slicesOut: BuildResult["slices"] = [];
  const manifest: IndexManifest = { version: CURRENT_PROTOCOL_VERSION, slices: [] };

  for (const slice of config.slices) {
    const rawMatches = await collectMatches(cwd, slice.include);
    const matches = rawMatches.filter((path) => !used.has(path));
    if (matches.length === 0) {
      throw configError(`Slice "${slice.id}" matched no files`);
    }
    await scanFilesForPromptInjection(cwd, matches);
    const packed = await packSlice(cwd, slice.include, [...used], { compress: slice.compress });
    for (const file of matches) used.add(file);

    const fileName = `${slice.id}.md`;
    slicesOut.push({
      id: slice.id,
      file: fileName,
      matchedFiles: packed.files.length > 0 ? packed.files : matches,
      content: renderSliceBody(slice, packed.content),
    });
    manifest.slices.push({
      id: slice.id,
      title: slice.title ?? titleFromId(slice.id),
      description: slice.description,
      file: fileName,
    });
  }

  if (!opts.checkOnly) {
    const outDir = join(cwd, "ctxbrew");
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    for (const entry of slicesOut) {
      const slice = config.slices.find((it) => it.id === entry.id);
      if (!slice) continue;
      const outFile = join(outDir, entry.file);
      await mkdir(dirname(outFile), { recursive: true });
      await Bun.write(outFile, entry.content);
    }
    await Bun.write(join(outDir, "index.yaml"), serializeIndexManifest(manifest));
  }

  return { slices: slicesOut, configPath };
};
