import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runGet } from "../src/cli/get.ts";
import { runPublish } from "../src/cli/publish.ts";
import { withCwd, withTmpDir, writeFiles, captureStdout } from "./helpers.ts";

const seedProject = async (root: string): Promise<void> => {
  await writeFiles(root, {
    "package.json": JSON.stringify({
      name: "demo",
      version: "1.0.0",
      ctxbrew: {
        cli: {
          components: "./docs/components/**",
          api: "./src/**/*.ts",
        },
      },
    }),
    "docs/components/Button.md": "# Button\nUse it.",
    "docs/components/Input.md": "# Input\nText.",
    "src/index.ts": "export const hi = () => 'hi';",
  });
};

describe("e2e: publish -> get", () => {
  test("publish writes .ctxbrew, get streams content from node_modules", async () => {
    await withTmpDir(async (proj) => {
      await seedProject(proj);
      await runPublish({ cwd: proj });

      await writeFiles(proj, {
        "node_modules/demo/package.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
      });
      await Bun.write(
        join(proj, "node_modules/demo/.ctxbrew/manifest.json"),
        await Bun.file(join(proj, ".ctxbrew/manifest.json")).text(),
      );

      const sourceFiles = await new Bun.Glob("**/*").scan({
        cwd: join(proj, ".ctxbrew/files"),
        onlyFiles: true,
      });
      for await (const relPath of sourceFiles) {
        await Bun.write(
          join(proj, "node_modules/demo/.ctxbrew/files", relPath),
          await Bun.file(join(proj, ".ctxbrew/files", relPath)).bytes(),
        );
      }

      await withCwd(proj, async () => {
        const sectionsOut = await captureStdout(() => runGet("demo", undefined, {}));
        expect(sectionsOut).toContain("components");
        expect(sectionsOut).toContain("api");

        const md = await captureStdout(() => runGet("demo", "components", {}));
        expect(md).toContain("# file: docs/components/Button.md");
        expect(md).toContain("# file: docs/components/Input.md");
        expect(md).toContain("<!-- ctxbrew: demo@1.0.0 | section: components | files: 2 -->");

        const json = await captureStdout(() => runGet("demo", "api", { json: true }));
        const parsed = JSON.parse(json);
        expect(parsed.files[0].path).toBe("src/index.ts");
        expect(parsed.files[0].lang).toBe("ts");

        const filesOnly = await captureStdout(() => runGet("demo", "components", { filesOnly: true }));
        expect(filesOnly.trim().split("\n").sort()).toEqual([
          "docs/components/Button.md",
          "docs/components/Input.md",
        ]);
      });
    });
  });

  test("missing section returns NOT_FOUND code", async () => {
    await withTmpDir(async (proj) => {
      await writeFiles(proj, {
        "node_modules/demo/package.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
        "node_modules/demo/.ctxbrew/manifest.json": JSON.stringify({
          schemaVersion: 1,
          name: "demo",
          version: "1.0.0",
          publishedAt: new Date().toISOString(),
          sections: { docs: { files: ["docs/a.md"] } },
        }),
        "node_modules/demo/.ctxbrew/files/docs/a.md": "# Demo",
      });
      await withCwd(proj, async () => {
        await expect(runGet("demo", "ghost", {})).rejects.toMatchObject({
          name: "CtxbrewError",
          code: 4,
        });
      });
    });
  });

  test("missing package returns NOT_FOUND code", async () => {
    await withTmpDir(async (proj) => {
      await withCwd(proj, async () => {
        await expect(runGet("ghost", "components", {})).rejects.toMatchObject({
          name: "CtxbrewError",
          code: 4,
        });
      });
    });
  });

  test("publish --dry-run writes nothing", async () => {
    await withTmpDir(async (proj) => {
      await seedProject(proj);
      await runPublish({ cwd: proj, dryRun: true });
      expect(await Bun.file(join(proj, ".ctxbrew/manifest.json")).exists()).toBe(false);
    });
  });
});

