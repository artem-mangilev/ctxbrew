#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLATFORM_MAP = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
};

const ARCH_MAP = {
  x64: "x64",
  arm64: "arm64",
};

const thisFile = fileURLToPath(import.meta.url);
const packageRoot = dirname(dirname(thisFile));

const platform = PLATFORM_MAP[process.platform];
const arch = ARCH_MAP[process.arch];

if (!platform || !arch) {
  process.stderr.write(
    `ctxb is not available for platform ${process.platform}/${process.arch}. ` +
      "Currently supported: darwin/linux/windows with x64 or arm64.\n",
  );
  process.exit(1);
}

const exeName = platform === "windows" ? `ctxb-${platform}-${arch}.exe` : `ctxb-${platform}-${arch}`;
const executablePath = join(packageRoot, "dist", exeName);

if (!existsSync(executablePath)) {
  process.stderr.write(
    `ctxb binary is missing at ${executablePath}.\n` +
      "This package expects prebuilt binaries in dist/. Reinstall or use a release that includes your target binary.\n",
  );
  process.exit(1);
}

const result = spawnSync(executablePath, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  process.stderr.write(`failed to run ${executablePath}: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
