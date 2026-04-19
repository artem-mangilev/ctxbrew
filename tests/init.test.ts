import { describe, expect, test } from "bun:test";
import { runInit } from "../src/cli/init.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("init", () => {
  test("writes package.json#ctxbrew", async () => {
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
    });
  });

  test("fails without package.json", async () => {
    await withTmpDir(async (dir) => {
      await expect(runInit({ cwd: dir })).rejects.toBeInstanceOf(CtxbrewError);
    });
  });
});
