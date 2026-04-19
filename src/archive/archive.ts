import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { integrityError } from "../utils/exit.ts";

export type PackInput = {
  files: Array<{ path: string; content: string | Uint8Array }>;
};

export type PackResult = {
  bytes: Uint8Array;
  sha256: string;
};

export const sha256Hex = (data: Uint8Array): string => {
  const h = new Bun.CryptoHasher("sha256");
  h.update(data);
  return h.digest("hex");
};

export const pack = async ({ files }: PackInput): Promise<PackResult> => {
  const map: Record<string, string | Uint8Array> = {};
  for (const f of files) map[f.path] = f.content;
  const archive = new Bun.Archive(map, { compress: "gzip" });
  const bytes = await archive.bytes();
  return { bytes, sha256: sha256Hex(bytes) };
};

export const verifyAndExtract = async (
  payload: Uint8Array,
  expectedSha256: string,
  destDir: string,
): Promise<{ files: string[] }> => {
  const actual = sha256Hex(payload);
  if (actual !== expectedSha256) {
    throw integrityError(
      `Payload integrity check failed (expected ${expectedSha256}, got ${actual})`,
      "Try `ctxb cache clear <name>` and re-fetch.",
    );
  }
  await mkdir(destDir, { recursive: true });
  const archive = new Bun.Archive(payload);
  const files = await archive.files();
  const written: string[] = [];
  for (const [relPath, file] of files) {
    const out = join(destDir, relPath);
    await mkdir(dirname(out), { recursive: true });
    await Bun.write(out, file);
    written.push(relPath);
  }
  return { files: written.sort() };
};
