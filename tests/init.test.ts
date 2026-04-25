import { describe, expect, test } from "bun:test";
import { runInit } from "../src/cli/init.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("init", () => {
  test("writes ctxbrew.yaml and package publish wiring", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({ name: "demo", version: "1.0.0" }),
      });
      await runInit({ cwd: dir });
      const pkg = (await Bun.file(`${dir}/package.json`).json()) as {
        files: string[];
        scripts: Record<string, string>;
      };
      expect(pkg.files).toContain("ctxbrew");
      expect(pkg.files).toContain("AGENTS.md");
      expect(pkg.scripts.prepack).toBe("ctxbrew build");
      expect(await Bun.file(`${dir}/ctxbrew.yaml`).exists()).toBe(true);
      expect(await Bun.file(`${dir}/.gitattributes`).text()).toContain("ctxbrew/**");
    });
  });
});
