import { inferLang } from "./langHints.ts";

export type RenderFormat = "markdown" | "json" | "files-only";

export type RenderFile = {
  path: string;
  content: string;
};

export type RenderOptions = {
  format: RenderFormat;
  packageName: string;
  section: string;
  version: string;
  extensions?: Record<string, string>;
  maxBytes?: number;
};

const longestFenceRun = (s: string): number => {
  let longest = 0;
  let current = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "`") {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
};

const fenceFor = (content: string): string => {
  const longest = longestFenceRun(content);
  return "`".repeat(Math.max(3, longest + 1));
};

export type RenderResult = {
  output: string;
  truncated: boolean;
  filesIncluded: number;
};

export const render = (files: RenderFile[], opts: RenderOptions): RenderResult => {
  switch (opts.format) {
    case "files-only":
      return renderFilesOnly(files, opts.maxBytes);
    case "json":
      return renderJson(files, opts);
    case "markdown":
      return renderMarkdown(files, opts);
  }
};

const truncateByBytes = <T>(
  items: T[],
  rendered: string[],
  maxBytes?: number,
): { kept: T[]; keptRendered: string[]; truncated: boolean } => {
  if (!maxBytes || maxBytes <= 0) {
    return { kept: items, keptRendered: rendered, truncated: false };
  }
  const enc = new TextEncoder();
  let total = 0;
  const kept: T[] = [];
  const keptRendered: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const size = enc.encode(rendered[i]).byteLength;
    if (total + size > maxBytes) {
      return { kept, keptRendered, truncated: true };
    }
    total += size;
    kept.push(items[i]);
    keptRendered.push(rendered[i]);
  }
  return { kept, keptRendered, truncated: false };
};

const renderFilesOnly = (files: RenderFile[], maxBytes?: number): RenderResult => {
  const lines = files.map((f) => `${f.path}\n`);
  const { kept, keptRendered, truncated } = truncateByBytes(files, lines, maxBytes);
  return {
    output: keptRendered.join(""),
    truncated,
    filesIncluded: kept.length,
  };
};

const renderJson = (files: RenderFile[], opts: RenderOptions): RenderResult => {
  const enriched = files.map((f) => ({
    path: f.path,
    lang: inferLang(f.path, opts.extensions),
    content: f.content,
  }));

  if (!opts.maxBytes || opts.maxBytes <= 0) {
    return {
      output: `${JSON.stringify(
        {
          name: opts.packageName,
          version: opts.version,
          section: opts.section,
          truncated: false,
          files: enriched,
        },
        null,
        2,
      )}\n`,
      truncated: false,
      filesIncluded: files.length,
    };
  }

  const enc = new TextEncoder();
  const sizes = enriched.map((f) => enc.encode(JSON.stringify(f)).byteLength);
  let total = 0;
  let kept = 0;
  for (let i = 0; i < sizes.length; i++) {
    if (total + sizes[i] > opts.maxBytes) break;
    total += sizes[i];
    kept += 1;
  }
  const truncated = kept < enriched.length;
  return {
    output: `${JSON.stringify(
      {
        name: opts.packageName,
        version: opts.version,
        section: opts.section,
        truncated,
        files: enriched.slice(0, kept),
      },
      null,
      2,
    )}\n`,
    truncated,
    filesIncluded: kept,
  };
};

const renderMarkdown = (files: RenderFile[], opts: RenderOptions): RenderResult => {
  const blocks = files.map((f) => {
    const lang = inferLang(f.path, opts.extensions);
    const content = f.content.endsWith("\n") ? f.content : `${f.content}\n`;

    if (lang === "md" || lang === "mdx") {
      return `# file: ${f.path}\n\n${content}\n`;
    }
    const fence = fenceFor(content);
    return `# file: ${f.path}\n\n${fence}${lang}\n${content}${fence}\n\n`;
  });

  const header =
    `<!-- ctxbrew: ${opts.packageName}@${opts.version} | section: ${opts.section} | files: ${files.length} -->\n\n`;

  const { kept, keptRendered, truncated } = truncateByBytes(files, blocks, opts.maxBytes);
  return {
    output: header + keptRendered.join(""),
    truncated,
    filesIncluded: kept.length,
  };
};
