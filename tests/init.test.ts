import { describe, expect, test } from "bun:test";
import { runInit } from "../src/cli/init.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("init", () => {
  test("writes package.json#ctxbrew and build integration defaults", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.0.0",
        }),
      });
      await runInit({ cwd: dir });
      const pkg = await Bun.file(`${dir}/package.json`).json();
      const ctxbrew = (pkg as Record<string, unknown>).ctxbrew as Record<string, unknown>;
      expect(ctxbrew).toBeDefined();
      expect(ctxbrew.cli).toBeDefined();
      expect((pkg as { files: string[] }).files).toContain(".ctxbrew");
      expect((pkg as { scripts: { prepack: string } }).scripts.prepack).toBe("ctxb build");
      expect(await Bun.file(`${dir}/.gitignore`).text()).toContain(".ctxbrew/");
    });
  });

  test("throws if prepack exists without ctxb build and --force is omitted", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.0.0",
          scripts: {
            prepack: "npm run build",
          },
        }),
      });
      await expect(runInit({ cwd: dir })).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("prepends ctxb build to prepack with --force", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.0.0",
          scripts: {
            prepack: "npm run build",
          },
        }),
      });
      await runInit({ cwd: dir, force: true });
      const pkg = await Bun.file(`${dir}/package.json`).json();
      expect((pkg as { scripts: { prepack: string } }).scripts.prepack).toBe("ctxb build && npm run build");
    });
  });

  test("fails without package.json", async () => {
    await withTmpDir(async (dir) => {
      await expect(runInit({ cwd: dir })).rejects.toBeInstanceOf(CtxbrewError);
    });
  });
});
