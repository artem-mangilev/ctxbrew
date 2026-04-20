import { describe, expect, test } from "bun:test";
import { runGet } from "../src/cli/get.ts";
import { captureStdout, withCwd, withTmpDir, writeFiles } from "./helpers.ts";

describe("get", () => {
  test("reads package sections from node_modules", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "node_modules/demo/package.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
        "node_modules/demo/.ctxbrew/manifest.json": JSON.stringify({
          schemaVersion: 1,
          name: "demo",
          version: "1.0.0",
          publishedAt: "2026-01-01T00:00:00.000Z",
          sections: {
            docs: { files: ["docs/a.md"] },
            api: { files: ["src/index.ts"] },
          },
        }),
        "node_modules/demo/.ctxbrew/files/docs/a.md": "# hello",
        "node_modules/demo/.ctxbrew/files/src/index.ts": "export const demo = 1;",
      });

      await withCwd(dir, async () => {
        const listOutput = await captureStdout(() => runGet("demo", undefined, {}));
        expect(listOutput).toContain("docs");
        expect(listOutput).toContain("api");

        const jsonOutput = await captureStdout(() => runGet("demo", "api", { json: true }));
        const parsed = JSON.parse(jsonOutput);
        expect(parsed.files[0].path).toBe("src/index.ts");

        const filesOnlyOutput = await captureStdout(() => runGet("demo", "docs", { filesOnly: true }));
        expect(filesOnlyOutput.trim()).toBe("docs/a.md");
      });
    });
  });

  test("errors when package has no .ctxbrew metadata", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "node_modules/demo/package.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
      });
      await withCwd(dir, async () => {
        await expect(runGet("demo", "docs", {})).rejects.toMatchObject({ code: 4 });
      });
    });
  });
});
