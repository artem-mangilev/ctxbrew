import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { discoverBunIndexPaths } from "../src/core/resolver/bun.ts";
import { discoverPnpmIndexPaths } from "../src/core/resolver/pnpm.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("resolver providers", () => {
  test("discovers pnpm packages through pnpm-lock.yaml", async () => {
    await withTmpDir(async (root) => {
      await writeFiles(root, {
        "pnpm-lock.yaml": [
          "lockfileVersion: '9.0'",
          "settings:",
          "  autoInstallPeers: true",
          "  excludeLinksFromLockfile: false",
          "importers:",
          "  .:",
          "    dependencies:",
          "      '@scope/pkg':",
          "        specifier: 1.0.0",
          "        version: 1.0.0",
          "packages:",
          "  '@scope/pkg@1.0.0':",
          "    resolution:",
          "      integrity: sha512-test",
          "",
        ].join("\n"),
        "node_modules/.pnpm/@scope+pkg@1.0.0/node_modules/@scope/pkg/ctxbrew/index.yaml": "version: 1\nslices: []\n",
      });
      const paths = await discoverPnpmIndexPaths(root);
      expect(paths).toContain(join(root, "node_modules/.pnpm/@scope+pkg@1.0.0/node_modules/@scope/pkg/ctxbrew/index.yaml"));
    });
  });

  test("discovers bun packages by parsing bun.lock", async () => {
    await withTmpDir(async (root) => {
      await writeFiles(root, {
        "bun.lock": JSON.stringify({
          lockfileVersion: 1,
          workspaces: {
            "": {
              dependencies: { "pkg-a": "1.0.0" },
            },
          },
          packages: {},
        }),
        "node_modules/pkg-a/ctxbrew/index.yaml": "version: 1\nslices: []\n",
      });
      const paths = await discoverBunIndexPaths(root);
      expect(paths).toContain(join(root, "node_modules/pkg-a/ctxbrew/index.yaml"));
    });
  });
});
