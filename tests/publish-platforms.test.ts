import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { writePlatformPackage } from "../scripts/publish-platforms.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("publish platform packages", () => {
  test("marks packaged binaries as executable", async () => {
    await withTmpDir(async (root) => {
      await writeFiles(root, {
        "dist/ctxbrew-test": "#!/bin/sh\n",
      });

      await writePlatformPackage(
        root,
        {
          name: "@ctxbrew/test-x64",
          os: ["linux"],
          cpu: ["x64"],
          distFile: "ctxbrew-test",
          binaryName: "ctxbrew",
        },
        "1.2.3",
        root,
      );

      const binary = join(root, "test-x64", "bin", "ctxbrew");
      const mode = (await stat(binary)).mode & 0o777;
      expect(mode).toBe(0o755);

      const pkg = await Bun.file(join(root, "test-x64", "package.json")).json();
      expect(pkg).toMatchObject({
        name: "@ctxbrew/test-x64",
        version: "1.2.3",
        files: ["bin/"],
      });
    });
  });
});
