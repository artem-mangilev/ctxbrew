import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pack, sha256Hex, verifyAndExtract } from "../src/archive/archive.ts";
import { CtxbrewError } from "../src/utils/exit.ts";
import { withTmpDir } from "./helpers.ts";

describe("archive", () => {
  test("packs and round-trips files", async () => {
    const { bytes, sha256 } = await pack({
      files: [
        { path: "a.txt", content: "hello" },
        { path: "sub/b.md", content: "# yo" },
      ],
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);

    await withTmpDir(async (dir) => {
      const result = await verifyAndExtract(bytes, sha256, dir);
      expect(result.files.sort()).toEqual(["a.txt", "sub/b.md"]);
      const a = await Bun.file(join(dir, "a.txt")).text();
      const b = await Bun.file(join(dir, "sub/b.md")).text();
      expect(a).toBe("hello");
      expect(b).toBe("# yo");
    });
  });

  test("rejects on integrity mismatch", async () => {
    const { bytes } = await pack({ files: [{ path: "a.txt", content: "hi" }] });
    await withTmpDir(async (dir) => {
      await expect(verifyAndExtract(bytes, "0".repeat(64), dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("rejects unsafe archive paths", async () => {
    const { bytes, sha256 } = await pack({ files: [{ path: "../escape.txt", content: "oops" }] });
    await withTmpDir(async (dir) => {
      await expect(verifyAndExtract(bytes, sha256, dir)).rejects.toBeInstanceOf(CtxbrewError);
    });
  });

  test("sha256Hex is stable", () => {
    const data = new TextEncoder().encode("hello");
    expect(sha256Hex(data)).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
