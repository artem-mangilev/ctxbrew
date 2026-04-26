import { describe, expect, test } from "bun:test";
import { runInit } from "../src/cli/init.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("init", () => {
  test("writes ctxbrew.yaml without changing package.json", async () => {
    await withTmpDir(async (dir) => {
      const packageJson = JSON.stringify({
        name: "demo",
        version: "1.0.0",
        scripts: {
          test: "bun test",
        },
      });
      await writeFiles(dir, {
        "package.json": packageJson,
      });
      await runInit({ cwd: dir });
      const yaml = await Bun.file(`${dir}/ctxbrew.yaml`).text();
      expect(yaml).toBe(
        [
          "version: 1",
          "slices:",
          "  - id: overview",
          "    description: High-level architecture",
          "    include:",
          "      - README.md",
          "",
        ].join("\n"),
      );
      expect(await Bun.file(`${dir}/package.json`).text()).toBe(packageJson);
      expect(await Bun.file(`${dir}/.gitattributes`).exists()).toBe(false);
      expect(await Bun.file(`${dir}/.gitignore`).exists()).toBe(false);
    });
  });

  test("writes ctxbrew.yaml when package.json is missing", async () => {
    await withTmpDir(async (dir) => {
      await runInit({ cwd: dir });
      expect(await Bun.file(`${dir}/ctxbrew.yaml`).exists()).toBe(true);
    });
  });
});
