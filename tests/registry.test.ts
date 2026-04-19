import { describe, expect, test } from "bun:test";
import { pack } from "../src/archive/archive.ts";
import { LocalFsRegistry } from "../src/registry/localFs.ts";
import { MANIFEST_SCHEMA_VERSION, type Manifest } from "../src/registry/types.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpCtxbrewHome } from "./helpers.ts";

const buildManifest = async (
  name: string,
  version: string,
): Promise<{ manifest: Manifest; payload: Uint8Array }> => {
  const { bytes, sha256 } = await pack({
    files: [{ path: "docs/a.md", content: `# ${name}@${version}` }],
  });
  return {
    manifest: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      name,
      version,
      publishedAt: new Date().toISOString(),
      payload: { sha256, bytes: bytes.byteLength },
      sections: { docs: { files: ["docs/a.md"] } },
    },
    payload: bytes,
  };
};

describe("LocalFsRegistry", () => {
  test("publish + listVersions + resolveVersion(latest)", async () => {
    await withTmpCtxbrewHome(async () => {
      const reg = new LocalFsRegistry();
      const a = await buildManifest("demo", "1.0.0");
      const b = await buildManifest("demo", "1.1.0");
      await reg.publish(a);
      await reg.publish(b);
      expect(await reg.listVersions("demo")).toEqual(["1.0.0", "1.1.0"]);
      expect(await reg.resolveVersion("demo", "latest")).toBe("1.1.0");
      expect(await reg.resolveVersion("demo", "^1.0.0")).toBe("1.1.0");
      expect(await reg.resolveVersion("demo", "1.0.0")).toBe("1.0.0");
    });
  });

  test("fetchManifest + fetchPayload return what we wrote", async () => {
    await withTmpCtxbrewHome(async () => {
      const reg = new LocalFsRegistry();
      const { manifest, payload } = await buildManifest("x", "0.1.0");
      await reg.publish({ manifest, payload });
      const m = await reg.fetchManifest("x", "0.1.0");
      expect(m.name).toBe("x");
      expect(m.payload.sha256).toBe(manifest.payload.sha256);
      const p = await reg.fetchPayload("x", "0.1.0");
      expect(p.byteLength).toBe(payload.byteLength);
    });
  });

  test("list returns published packages", async () => {
    await withTmpCtxbrewHome(async () => {
      const reg = new LocalFsRegistry();
      await reg.publish(await buildManifest("a", "1.0.0"));
      await reg.publish(await buildManifest("b", "2.0.0"));
      await reg.publish(await buildManifest("b", "2.1.0"));
      const list = await reg.list();
      expect(list).toEqual([
        { name: "a", versions: ["1.0.0"], latest: "1.0.0" },
        { name: "b", versions: ["2.0.0", "2.1.0"], latest: "2.1.0" },
      ]);
    });
  });

  test("not-found errors are typed", async () => {
    await withTmpCtxbrewHome(async () => {
      const reg = new LocalFsRegistry();
      await expect(reg.resolveVersion("ghost", "latest")).rejects.toBeInstanceOf(CtxbrewError);
      await expect(reg.fetchManifest("ghost", "1.0.0")).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("range with no satisfying version errors", async () => {
    await withTmpCtxbrewHome(async () => {
      const reg = new LocalFsRegistry();
      await reg.publish(await buildManifest("p", "1.0.0"));
      await expect(reg.resolveVersion("p", "^2.0.0")).rejects.toBeInstanceOf(CtxbrewError);
    });
  });
});
