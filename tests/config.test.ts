import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config/load.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpDir, writeFiles } from "./helpers.ts";

describe("config loader", () => {
  test("loads .ctxbrewrc.json", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({ name: "demo", version: "1.2.3" }),
        ".ctxbrewrc.json": JSON.stringify({ cli: { docs: "./docs/**" } }),
      });
      const { config, configPath } = await loadConfig(dir);
      expect(config.name).toBe("demo");
      expect(config.version).toBe("1.2.3");
      expect(config.cli.docs).toEqual(["./docs/**"]);
      expect(configPath).toBe(join(dir, ".ctxbrewrc.json"));
    });
  });

  test("loads .ctxbrewrc (json content)", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({ name: "demo", version: "1.2.3" }),
        ".ctxbrewrc": JSON.stringify({ cli: { docs: "./docs/**" } }),
      });
      const { config, configPath } = await loadConfig(dir);
      expect(config.name).toBe("demo");
      expect(config.version).toBe("1.2.3");
      expect(config.cli.docs).toEqual(["./docs/**"]);
      expect(configPath).toBe(join(dir, ".ctxbrewrc"));
    });
  });

  test("loads package.json#ctxbrew", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.2.3",
          ctxbrew: { cli: { docs: "./docs/**" } },
        }),
      });
      const { config, configPath } = await loadConfig(dir);
      expect(config.name).toBe("demo");
      expect(config.version).toBe("1.2.3");
      expect(config.cli.docs).toEqual(["./docs/**"]);
      expect(configPath).toBe(`${join(dir, "package.json")}#ctxbrew`);
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
        "package.json": JSON.stringify({
          name: "x",
          version: "1.0.0",
          ctxbrew: { cli: { "Bad Section": "./**" } },
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects empty cli", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "x",
          version: "1.0.0",
          ctxbrew: { cli: {} },
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects invalid package name", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "Bad Name",
          version: "1.0.0",
          ctxbrew: { cli: { x: "./**" } },
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects deprecated keys in package.json#ctxbrew", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.0.0",
          ctxbrew: {
            cli: { docs: "./docs/**" },
            limits: { maxBytes: 123 },
          },
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("requires at least one supported config source", async () => {
    await withTmpDir(async (dir) => {
      await writeFiles(dir, {
        "package.json": JSON.stringify({
          name: "demo",
          version: "1.0.0",
        }),
      });
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("missing config errors", async () => {
    await withTmpDir(async (dir) => {
      await expect(loadConfig(dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });
});
