import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runPublish } from "../src/cli/publish.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("publish", () => {
  test("writes manifest and section files into .ctxbrew", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.0.0",
          ctxbrew: {
            cli: {
              docs: "./docs/**/*.md",
              api: "./src/**/*.ts",
            },
          },
        }),
        "docs/a.md": "# a",
        "docs/b.md": "# b",
        "src/index.ts": "export const x = 1;",
      });

      await runPublish({ cwd: dir });

      const manifest = await Bun.file(join(dir, ".ctxbrew/manifest.json")).json();
      expect((manifest as { name: string }).name).toBe("demo");
      expect((manifest as { sections: Record<string, { files: string[] }> }).sections.docs.files).toEqual([
        "docs/a.md",
        "docs/b.md",
      ]);
      expect(
        await Bun.file(join(dir, ".ctxbrew/files/docs/a.md")).text(),
      ).toBe("# a");
      expect(
        await Bun.file(join(dir, ".ctxbrew/files/src/index.ts")).text(),
      ).toContain("export const x");
    });
  });
});
