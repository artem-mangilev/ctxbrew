#!/usr/bin/env bun

const version = process.env.CTXBREW_RELEASE_VERSION;
if (!version) {
  process.stderr.write("CTXBREW_RELEASE_VERSION is required\n");
  process.exit(1);
}

const packageJsonPath = new URL("../package.json", import.meta.url);
const pkgFile = Bun.file(packageJsonPath);
const pkg = (await pkgFile.json()) as {
  optionalDependencies?: Record<string, string>;
};

const optional = pkg.optionalDependencies ?? {};
const nextOptional: Record<string, string> = {};
for (const [dep] of Object.entries(optional)) {
  if (dep.startsWith("@ctxbrew/")) {
    nextOptional[dep] = version;
  } else {
    nextOptional[dep] = optional[dep];
  }
}

pkg.optionalDependencies = nextOptional;
await Bun.write(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
