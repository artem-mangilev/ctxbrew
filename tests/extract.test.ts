import { describe, expect, test } from "bun:test";
import { collectFiles } from "../src/extract/collect.ts";
import { render } from "../src/extract/render.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("collectFiles", () => {
  test("matches glob patterns and sorts results", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "docs/b.md": "b",
        "docs/a.md": "a",
        "docs/sub/c.md": "c",
        "src/index.ts": "x",
      });
      const files = await collectFiles({
        root: dir,
        patterns: ["./docs/**/*.md"],
      });
      expect(files).toEqual(["docs/a.md", "docs/b.md", "docs/sub/c.md"]);
    });
  });

  test("supports excludes via leading !", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "src/a.ts": "a",
        "src/a.test.ts": "t",
        "src/b.ts": "b",
      });
      const files = await collectFiles({
        root: dir,
        patterns: ["./src/**/*.ts", "!**/*.test.ts"],
      });
      expect(files).toEqual(["src/a.ts", "src/b.ts"]);
    });
  });

  test("rejects absolute patterns", async () => {
    await withTmpDir(async (dir) => {
      await expect(
        collectFiles({ root: dir, patterns: ["/etc/passwd"] }),
      ).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects .. escapes", async () => {
    await withTmpDir(async (dir) => {
      await expect(
        collectFiles({ root: dir, patterns: ["../**"] }),
      ).rejects.toBeInstanceOf(CtxbrewError);
    });
  });
});

describe("render markdown", () => {
  test("emits header and per-file blocks", () => {
    const out = render(
      [
        { path: "docs/a.md", content: "# A" },
        { path: "src/x.ts", content: "export const x = 1;" },
      ],
      {
        format: "markdown",
        packageName: "demo",
        version: "1.0.0",
        section: "all",
      },
    );
    expect(out.output).toContain("<!-- ctxbrew: demo@1.0.0 | section: all | files: 2 -->");
    expect(out.output).toContain("# file: docs/a.md");
    expect(out.output).toContain("# file: src/x.ts");
    expect(out.output).toContain("```ts");
    expect(out.truncated).toBe(false);
    expect(out.filesIncluded).toBe(2);
  });

  test("escapes nested fences in source", () => {
    const out = render(
      [{ path: "docs/x.md", content: "ignored" }, { path: "src/y.ts", content: "// ```\nconst y = 1;\n// ```" }],
      { format: "markdown", packageName: "p", version: "1.0.0", section: "s" },
    );
    expect(out.output).toMatch(/````ts\n/);
  });

  test("truncates by maxBytes", () => {
    const big = "x".repeat(2000);
    const out = render(
      Array.from({ length: 5 }, (_, i) => ({ path: `f${i}.txt`, content: big })),
      { format: "markdown", packageName: "p", version: "1.0.0", section: "s", maxBytes: 3000 },
    );
    expect(out.truncated).toBe(true);
    expect(out.filesIncluded).toBeLessThan(5);
  });
});

describe("render json", () => {
  test("emits structured output with lang inference", () => {
    const out = render(
      [{ path: "src/a.go", content: "package main" }],
      { format: "json", packageName: "p", version: "1.0.0", section: "s" },
    );
    const parsed = JSON.parse(out.output);
    expect(parsed.files[0].lang).toBe("go");
    expect(parsed.files[0].path).toBe("src/a.go");
    expect(parsed.truncated).toBe(false);
  });
});

describe("render files-only", () => {
  test("emits paths line by line", () => {
    const out = render(
      [
        { path: "a.md", content: "1" },
        { path: "b.md", content: "2" },
      ],
      { format: "files-only", packageName: "p", version: "1.0.0", section: "s" },
    );
    expect(out.output).toBe("a.md\nb.md\n");
  });
});
