#!/usr/bin/env bun
import { chmod, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PlatformPkg = {
  name: string;
  os: string[];
  cpu: string[];
  distFile: string;
  binaryName: string;
};

export const PLATFORMS: PlatformPkg[] = [
  {
    name: "@ctxbrew/darwin-arm64",
    os: ["darwin"],
    cpu: ["arm64"],
    distFile: "ctxbrew-darwin-arm64",
    binaryName: "ctxbrew",
  },
  {
    name: "@ctxbrew/darwin-x64",
    os: ["darwin"],
    cpu: ["x64"],
    distFile: "ctxbrew-darwin-x64",
    binaryName: "ctxbrew",
  },
  {
    name: "@ctxbrew/linux-x64",
    os: ["linux"],
    cpu: ["x64"],
    distFile: "ctxbrew-linux-x64",
    binaryName: "ctxbrew",
  },
  {
    name: "@ctxbrew/linux-arm64",
    os: ["linux"],
    cpu: ["arm64"],
    distFile: "ctxbrew-linux-arm64",
    binaryName: "ctxbrew",
  },
  {
    name: "@ctxbrew/win32-x64",
    os: ["win32"],
    cpu: ["x64"],
    distFile: "ctxbrew-windows-x64.exe",
    binaryName: "ctxbrew.exe",
  },
];

const run = async (cmd: string[], cwd: string): Promise<void> => {
  const proc = Bun.spawn({ cmd, cwd, stdout: "inherit", stderr: "inherit", stdin: "inherit" });
  const code = await proc.exited;
  if (code !== 0) process.exit(code);
};

export const writePlatformPackage = async (
  workspace: string,
  platform: PlatformPkg,
  version: string,
  sourceRoot = process.cwd(),
): Promise<void> => {
  const dir = join(workspace, platform.name.replace("@ctxbrew/", ""));
  await mkdir(join(dir, "bin"), { recursive: true });
  const src = join(sourceRoot, "dist", platform.distFile);
  const dest = join(dir, "bin", platform.binaryName);
  const bytes = await Bun.file(src).bytes();
  await Bun.write(dest, bytes);
  await chmod(dest, 0o755);
  await Bun.write(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: platform.name,
        version,
        os: platform.os,
        cpu: platform.cpu,
        files: ["bin/"],
      },
      null,
      2,
    )}\n`,
  );
};

const main = async (): Promise<void> => {
  const version = process.env.CTXBREW_RELEASE_VERSION;
  if (!version) {
    process.stderr.write("CTXBREW_RELEASE_VERSION env var is required.\n");
    process.exit(1);
  }

  const npmToken = process.env.NPM_TOKEN ?? process.env.NODE_AUTH_TOKEN;
  if (!npmToken) {
    process.stderr.write("NPM_TOKEN (or NODE_AUTH_TOKEN) is required.\n");
    process.exit(1);
  }

  const workspace = await mkdtemp(join(tmpdir(), "ctxbrew-platforms-"));
  try {
    for (const platform of PLATFORMS) {
      await writePlatformPackage(workspace, platform, version);
      const cwd = join(workspace, platform.name.replace("@ctxbrew/", ""));
      await run(["npm", "publish", "--access", "public"], cwd);
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  await main();
}
