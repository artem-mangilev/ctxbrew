#!/usr/bin/env bun
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

type Target = {
  bunTarget: string;
  outName: string;
};

const TARGETS: Target[] = [
  { bunTarget: "bun-darwin-arm64", outName: "ctxbrew-darwin-arm64" },
  { bunTarget: "bun-darwin-x64", outName: "ctxbrew-darwin-x64" },
  { bunTarget: "bun-linux-x64", outName: "ctxbrew-linux-x64" },
  { bunTarget: "bun-linux-arm64", outName: "ctxbrew-linux-arm64" },
  { bunTarget: "bun-windows-x64", outName: "ctxbrew-windows-x64.exe" },
];

const ENTRY = "./src/bin/ctxbrew.ts";
const OUT_DIR = "dist";

const main = async (): Promise<void> => {
  const requested = process.argv.slice(2);
  const selected = requested.length > 0
    ? TARGETS.filter((t) => requested.some((r) => t.bunTarget.includes(r) || t.outName.includes(r)))
    : TARGETS;

  if (selected.length === 0) {
    console.error(`No matching targets. Available:`);
    for (const t of TARGETS) console.error(`  - ${t.bunTarget}`);
    process.exit(1);
  }

  if (selected.length === TARGETS.length) {
    await rm(OUT_DIR, { recursive: true, force: true });
  } else {
    for (const t of selected) {
      await rm(join(OUT_DIR, t.outName), { force: true });
    }
  }
  await mkdir(OUT_DIR, { recursive: true });

  for (const t of selected) {
    const outfile = join(OUT_DIR, t.outName);
    process.stderr.write(`-> ${t.bunTarget} -> ${outfile}\n`);
    const isDarwin = t.bunTarget.startsWith("bun-darwin");
    // Workaround: Bun 1.3.12 has a code-signature size regression on darwin
    // (oven-sh/bun#29270). We disable Bun's internal codesign and re-sign with
    // the system codesign afterward. Remove once Bun ships the fix.
    const env = isDarwin ? { ...process.env, BUN_NO_CODESIGN_MACHO_BINARY: "1" } : process.env;
    const proc = Bun.spawn({
      cmd: [
        "bun",
        "build",
        "--compile",
        "--minify",
        `--target=${t.bunTarget}`,
        ENTRY,
        "--outfile",
        outfile,
      ],
      stdout: "inherit",
      stderr: "inherit",
      env,
    });
    const code = await proc.exited;
    if (code !== 0) {
      process.stderr.write(`build failed for ${t.bunTarget} (exit ${code})\n`);
      process.exit(code);
    }
    if (isDarwin && process.platform === "darwin") {
      const sign = Bun.spawn({
        cmd: ["codesign", "--force", "--sign", "-", outfile],
        stdout: "inherit",
        stderr: "inherit",
      });
      const sc = await sign.exited;
      if (sc !== 0) {
        process.stderr.write(`codesign failed for ${outfile} (exit ${sc})\n`);
        process.exit(sc);
      }
    } else if (isDarwin) {
      process.stderr.write(
        `note: produced unsigned ${outfile}; sign with \`codesign --sign - ${outfile}\` (macOS) or \`rcodesign sign ${outfile}\` (linux)\n`,
      );
    }
  }
  process.stderr.write(`done: ${selected.length} target(s)\n`);
};

main();
