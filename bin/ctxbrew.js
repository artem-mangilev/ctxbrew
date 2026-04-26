#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const platform = process.platform;
const arch = process.arch;
const packageName = `@ctxbrew/${platform}-${arch}`;
const binaryName = platform === "win32" ? "ctxbrew.exe" : "ctxbrew";
const req = createRequire(import.meta.url);
const packageVersion = req("../package.json").version;

let binaryPath;
try {
  binaryPath = req.resolve(`${packageName}/bin/${binaryName}`);
} catch {
  console.error(`ctxbrew: no binary for ${platform}-${arch}`);
  console.error("Supported: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64");
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
  env: { ...process.env, CTXBREW_VERSION: packageVersion },
});
if (result.error) {
  console.error(`ctxbrew: failed to run ${binaryPath}: ${result.error.message}`);
  if (result.error.code === "EACCES") {
    console.error("ctxbrew: platform binary is not executable; reinstall or upgrade ctxbrew.");
  }
  process.exit(1);
}
process.exit(result.status ?? 1);
