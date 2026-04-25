import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadCtxbrewConfig, titleFromId, type CtxbrewSlice } from "./config.ts";
import { renderFrontmatter } from "./frontmatter.ts";
import { type IndexManifest, serializeIndexManifest } from "./index-manifest.ts";
import { CURRENT_PROTOCOL_VERSION } from "./protocol.ts";
import { runRepomix } from "./repomix-runner.ts";
import { assertNoPromptInjection, validateConfigForBuild } from "./validator.ts";
import { configError } from "../utils/exit.ts";

export type BuildResult = {
  slices: Array<{ id: string; file: string; matchedFiles: string[] }>;
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

const renderSliceBody = async (cwd: string, slice: CtxbrewSlice, files: string[]): Promise<string> => {
  const title = slice.title ?? titleFromId(slice.id);
  const frontmatter = renderFrontmatter({
    id: slice.id,
    title,
    description: slice.description,
  });
  const chunks: string[] = [frontmatter, `\n# ${title}\n\n## Files\n\n`];
  for (const relPath of files) {
    const file = Bun.file(join(cwd, relPath));
    const text = await file.text();
    assertNoPromptInjection(relPath, text);
    chunks.push(`### ${relPath}\n\n\`\`\`\n${text.endsWith("\n") ? text : `${text}\n`}\`\`\`\n\n`);
  }
  return chunks.join("");
};

const ensureAgentsFile = async (cwd: string): Promise<void> => {
  const content = [
    "# AGENTS",
    "",
    "This package ships ctxbrew context slices.",
    "Use `ctxbrew list <package>` and `ctxbrew get <package> <slice-id>`.",
    "",
  ].join("\n");
  await Bun.write(join(cwd, "AGENTS.md"), content);
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
    await runRepomix(cwd, slice.include);
    const rawMatches = await collectMatches(cwd, slice.include);
    const matches = rawMatches.filter((path) => !used.has(path));
    for (const file of matches) used.add(file);
    if (matches.length === 0) {
      throw configError(`Slice "${slice.id}" matched no files`);
    }

    const fileName = `${slice.id}.md`;
    slicesOut.push({ id: slice.id, file: fileName, matchedFiles: matches });
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
      const body = await renderSliceBody(cwd, slice, entry.matchedFiles);
      const outFile = join(outDir, entry.file);
      await mkdir(dirname(outFile), { recursive: true });
      await Bun.write(outFile, body);
    }
    await Bun.write(join(outDir, "index.yaml"), serializeIndexManifest(manifest));
    await ensureAgentsFile(cwd);
  }

  return { slices: slicesOut, configPath };
};
