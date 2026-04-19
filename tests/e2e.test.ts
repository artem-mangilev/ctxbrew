import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runGet } from "../src/cli/get.ts";
import { runInfo } from "../src/cli/info.ts";
import { runList } from "../src/cli/list.ts";
import { runPublish } from "../src/cli/publish.ts";
import { LocalFsRegistry } from "../src/registry/localFs.ts";
import { withTmpCtxbrewHome, withTmpDir, writeFiles } from "./helpers.ts";

const captureStdout = async (fn: () => Promise<void>): Promise<string> => {
  const original = process.stdout.write.bind(process.stdout);
  let buf = "";
  (process.stdout as unknown as { write: (s: unknown) => boolean }).write = (s: unknown) => {
    buf += typeof s === "string" ? s : new TextDecoder().decode(s as Uint8Array);
    return true;
  };
  try {
    await fn();
  } finally {
    (process.stdout as unknown as { write: (s: unknown) => boolean }).write = original as unknown as (s: unknown) => boolean;
  }
  return buf;
};

const seedProject = async (root: string): Promise<void> => {
  await writeFiles(root, {
    "package.json": JSON.stringify({
      name: "demo",
      version: "1.0.0",
      ctxbrew: {
        cli: {
          components: "./docs/components/**",
          api: "./src/**/*.ts",
        },
      },
    }),
    "docs/components/Button.md": "# Button\nUse it.",
    "docs/components/Input.md": "# Input\nText.",
    "src/index.ts": "export const hi = () => 'hi';",
  });
};

describe("e2e: publish -> get", () => {
  test("publish writes registry, get streams content", async () => {
    await withTmpCtxbrewHome(async () => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);

        await runPublish({ cwd: proj });

        const reg = new LocalFsRegistry();
        expect(await reg.listVersions("demo")).toEqual(["1.0.0"]);

        const sectionsOut = await captureStdout(() => runGet("demo", undefined, {}));
        expect(sectionsOut).toContain("components");
        expect(sectionsOut).toContain("api");

        const md = await captureStdout(() => runGet("demo", "components", {}));
        expect(md).toContain("# file: docs/components/Button.md");
        expect(md).toContain("# file: docs/components/Input.md");
        expect(md).toContain("<!-- ctxbrew: demo@1.0.0 | section: components | files: 2 -->");

        const json = await captureStdout(() => runGet("demo", "api", { json: true }));
        const parsed = JSON.parse(json);
        expect(parsed.files[0].path).toBe("src/index.ts");
        expect(parsed.files[0].lang).toBe("ts");

        const filesOnly = await captureStdout(() => runGet("demo", "components", { filesOnly: true }));
        expect(filesOnly.trim().split("\n").sort()).toEqual([
          "docs/components/Button.md",
          "docs/components/Input.md",
        ]);
      });
    });
  });

  test("missing section returns NOT_FOUND code", async () => {
    await withTmpCtxbrewHome(async () => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);
        await runPublish({ cwd: proj });
        await expect(runGet("demo", "ghost", {})).rejects.toMatchObject({
          name: "CtxbrewError",
          code: 4,
        });
      });
    });
  });

  test("integrity mismatch on tampered payload", async () => {
    await withTmpCtxbrewHome(async (home) => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);
        await runPublish({ cwd: proj });
        const payloadPath = join(home, "registry", "demo", "1.0.0", "payload.tar.gz");
        const original = await Bun.file(payloadPath).bytes();
        const tampered = new Uint8Array(original);
        tampered[tampered.length - 1] ^= 0xff;
        await Bun.write(payloadPath, tampered);
        await expect(runGet("demo", "components", { noCache: true })).rejects.toMatchObject({
          name: "CtxbrewError",
          code: 5,
        });
      });
    });
  });

  test("cache is invalidated if ready marker sha mismatches manifest", async () => {
    await withTmpCtxbrewHome(async (home) => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);
        await runPublish({ cwd: proj });
        await runGet("demo", "components", {});

        const markerPath = join(home, "cache", "demo", "1.0.0", ".ctxbrew-ready");
        await Bun.write(markerPath, "0".repeat(64));

        await expect(runGet("demo", "components", {})).resolves.toBeUndefined();
        const marker = (await Bun.file(markerPath).text()).trim();
        expect(marker).toMatch(/^[0-9a-f]{64}$/);
        expect(marker).not.toBe("0".repeat(64));
      });
    });
  });

  test("publish --dry-run writes nothing", async () => {
    await withTmpCtxbrewHome(async () => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);
        await runPublish({ cwd: proj, dryRun: true });
        const reg = new LocalFsRegistry();
        expect(await reg.list()).toEqual([]);
      });
    });
  });

  test("info and list work", async () => {
    await withTmpCtxbrewHome(async () => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);
        await runPublish({ cwd: proj });
        const listOut = await captureStdout(() => runList({}));
        expect(listOut).toContain("demo");
        const infoOut = await captureStdout(() => runInfo("demo", { json: true }));
        const parsed = JSON.parse(infoOut);
        expect(parsed.name).toBe("demo");
        expect(parsed.payload.sha256).toMatch(/^[0-9a-f]{64}$/);
      });
    });
  });

  test("env-based version pinning", async () => {
    await withTmpCtxbrewHome(async () => {
      await withTmpDir(async (proj) => {
        await seedProject(proj);
        await runPublish({ cwd: proj });
        await runPublish({ cwd: proj, version: "2.0.0" });
        const reg = new LocalFsRegistry();
        expect(await reg.listVersions("demo")).toEqual(["1.0.0", "2.0.0"]);

        process.env.CTXBREW_DEMO_VERSION = "1.0.0";
        try {
          const out = await captureStdout(() => runGet("demo", undefined, {}));
          expect(out).toContain("demo@1.0.0");
        } finally {
          delete process.env.CTXBREW_DEMO_VERSION;
        }
      });
    });
  });
});

