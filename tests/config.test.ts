import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config/load.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("config loader", () => {
  test("loads ctxbrew.config.json with explicit name/version", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "ctxbrew.config.json": JSON.stringify({
          name: "demo",
          version: "1.2.3",
          cli: { docs: "./docs/**" },
        }),
      });
      const { config, configPath } = await loadConfig(dir);
      expect(config.name).toBe("demo");
      expect(config.version).toBe("1.2.3");
      expect(config.cli.docs).toEqual(["./docs/**"]);
      expect(configPath).toBe(join(dir, "ctxbrew.config.json"));
      expect(config.limits.maxBytes).toBeGreaterThan(0);
    });
  });

  test("falls back to package.json for name/version", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({ name: "from-pkg", version: "9.9.9" }),
        "ctxbrew.config.json": JSON.stringify({ cli: { api: "./src/**" } }),
      });
      const { config } = await loadConfig(dir);
      expect(config.name).toBe("from-pkg");
      expect(config.version).toBe("9.9.9");
    });
  });

  test("reads `ctxbrew` field from package.json", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "react",
          version: "19.0.0",
          ctxbrew: { cli: { components: "./components/**" } },
        }),
      });
      const { config } = await loadConfig(dir);
      expect(config.name).toBe("react");
      expect(config.version).toBe("19.0.0");
      expect(config.cli.components).toEqual(["./components/**"]);
    });
  });

  test("rejects invalid section name", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "ctxbrew.config.json": JSON.stringify({
          name: "x",
          version: "1.0.0",
          cli: { "Bad Section": "./**" },
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects empty cli", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "ctxbrew.config.json": JSON.stringify({ name: "x", version: "1.0.0", cli: {} }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects invalid package name", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "ctxbrew.config.json": JSON.stringify({
          name: "Bad Name",
          version: "1.0.0",
          cli: { x: "./**" },
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("autodetects from Cargo.toml", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "Cargo.toml": '[package]\nname = "rust-lib"\nversion = "0.5.0"\n',
        "ctxbrew.config.json": JSON.stringify({ cli: { docs: "./**" } }),
      });
      const { config } = await loadConfig(dir);
      expect(config.name).toBe("rust-lib");
      expect(config.version).toBe("0.5.0");
    });
  });

  test("autodetects from go.mod", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "go.mod": "module github.com/example/widget\n\ngo 1.21\n",
        "ctxbrew.config.json": JSON.stringify({
          version: "1.0.0",
          cli: { pkg: "./**" },
        }),
      });
      const { config } = await loadConfig(dir);
      expect(config.name).toBe("widget");
    });
  });

  test("missing config errors", async () => {
    await withTmpDir(async (dir) => {
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });
});
