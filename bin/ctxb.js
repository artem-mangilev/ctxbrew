#!/usr/bin/env node
import { spawn } from "node:child_process";
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

const FORWARDED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"];

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
const distDir = join(packageRoot, "dist");
const executablePath = join(distDir, exeName);

if (!existsSync(executablePath)) {
  // `scripts/` is not included in the published tarball (see package.json#files),
  // so its presence reliably identifies a git checkout / `npm link` scenario.
  const looksLikeSourceCheckout = existsSync(join(packageRoot, "scripts", "build.ts"));
  const lines = [`ctxb binary is missing at ${executablePath}.`];
  if (looksLikeSourceCheckout) {
    lines.push(
      "Looks like a local checkout. Build the binary first:",
      `  bun install && bun run build ${platform}-${arch}`,
      "Or run the source directly during development: bun run dev",
    );
  } else {
    lines.push(
      "This package expects prebuilt binaries in dist/.",
      "Reinstall ctxbrew, or use a release that includes your target binary.",
    );
  }
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
}

const child = spawn(executablePath, process.argv.slice(2), { stdio: "inherit" });

const forwarders = FORWARDED_SIGNALS.map((signal) => {
  const handler = () => {
    if (!child.killed) child.kill(signal);
  };
  process.on(signal, handler);
  return [signal, handler];
});

child.on("error", (err) => {
  process.stderr.write(`failed to run ${executablePath}: ${err.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  for (const [name, handler] of forwarders) process.off(name, handler);
  if (signal) {
    // Re-raise the signal so the parent shell observes the correct exit status
    // (e.g. 130 for SIGINT). If re-raising does not terminate us, fall back to
    // encoding the signal in the exit code.
    process.kill(process.pid, signal);
    process.exit(128 + (signalNumber(signal) ?? 0));
  }
  process.exit(code ?? 1);
});

function signalNumber(signal) {
  const table = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGTERM: 15 };
  return table[signal];
}
