import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runBuild } from "../src/cli/build.ts";
import { runGet } from "../src/cli/get.ts";
import { runList } from "../src/cli/list.ts";
import { runSearch } from "../src/cli/search.ts";
import { captureStdout, withCwd, withTmpDir, writeFiles } from "./helpers.ts";

describe("e2e", () => {
  test("build + list + get + search", async () => {
    await withTmpDir(async (root) => {
      await writeFiles(root, {
        "package.json": JSON.stringify({ name: "pkg-a", version: "1.2.3" }),
        "README.md": "# Demo",
        "src/a.ts": "export const a = 1;\n",
        "ctxbrew.yaml": [
          "version: 1",
          "slices:",
          "  - id: overview",
          "    description: Overview docs",
          "    include:",
          "      - README.md",
          "  - id: api",
          "    description: API sources",
          "    include:",
          "      - src/**/*.ts",
          "",
        ].join("\n"),
      });

      await runBuild({ cwd: root });

      await writeFiles(root, {
        "node_modules/pkg-a/package.json": JSON.stringify({ name: "pkg-a", version: "1.2.3" }),
      });
      await Bun.write(
        join(root, "node_modules/pkg-a/ctxbrew/index.yaml"),
        await Bun.file(join(root, "ctxbrew/index.yaml")).text(),
      );
      await Bun.write(
        join(root, "node_modules/pkg-a/ctxbrew/overview.md"),
        await Bun.file(join(root, "ctxbrew/overview.md")).text(),
      );
      await Bun.write(
        join(root, "node_modules/pkg-a/ctxbrew/api.md"),
        await Bun.file(join(root, "ctxbrew/api.md")).text(),
      );

      await withCwd(root, async () => {
        const listOutput = await captureStdout(async () => {
          await runList();
        });
        expect(listOutput).toContain("pkg-a@1.2.3");

        const getOutput = await captureStdout(async () => {
          await runGet("pkg-a", "overview");
        });
        expect(getOutput).toContain("<!-- ctxbrew pkg-a@1.2.3 slice:overview -->");

        const searchOutput = await captureStdout(async () => {
          await runSearch("api", {});
        });
        expect(searchOutput).toContain("pkg-a api");
      });
    });
  });
});
