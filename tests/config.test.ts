import { describe, expect, test } from "bun:test";
import { loadCtxbrewConfig } from "../src/core/config.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("config", () => {
  test("loads valid ctxbrew.yaml", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "ctxbrew.yaml": [
          "version: 1",
          "slices:",
          "  - id: overview",
          "    description: Overview",
          "    compress: true",
          "    include:",
          "      - README.md",
          "",
        ].join("\n"),
      });
      const loaded = await loadCtxbrewConfig(dir);
      expect(loaded.config.slices[0].id).toBe("overview");
      expect(loaded.config.slices[0].compress).toBe(true);
    });
  });
});
