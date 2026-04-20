# ctxbrew

`ctxbrew` packages docs/source into versioned context bundles for AI agents.

Install package `ctxbrew`, run command `ctxb`.

```bash
ctxb get react components
```

## Install

### From npm (prebuilt binary)

```bash
npm install -g ctxbrew
ctxb --version
```

`ctxbrew` npm package includes a platform-specific prebuilt `ctxb` binary for:

- macOS: arm64, x64
- Linux: arm64, x64
- Windows: x64

## Quick Start

```bash
ctxb init
```

This adds `ctxbrew` config and npm publish wiring in `package.json`:

```json
{
  "name": "my-library",
  "version": "0.1.0",
  "files": ["dist", ".ctxbrew"],
  "scripts": {
    "prepack": "ctxb build"
  },
  "ctxbrew": {
    "cli": {
      "docs": "./docs/**/*.md",
      "api": ["./src/**/*.ts", "!**/*.test.ts"]
    }
  }
}
```

Build ctxbrew artifacts (also runs automatically during `npm publish` via `prepack`):

```bash
ctxb build
```

Install the package and read sections from installed `node_modules`:

```bash
ctxb get my-library
ctxb get my-library docs
ctxb get my-library api --json 
ctxb get my-library docs --files-only
```

## Config Source

Config discovery order:

1. `.ctxbrewrc.json`
2. `.ctxbrewrc` (JSON content)
3. `package.json#ctxbrew`

Example:

```json
{
  "name": "react",
  "version": "19.0.0",
  "ctxbrew": {
    "cli": {
      "components": "./docs/components/**",
      "directives": "./docs/directives/**",
      "api": ["./src/**/*.ts", "!**/*.test.ts"]
    }
  }
}
```

## CLI

### `ctxb init [--cwd DIR] [--force]`

Create/update starter `package.json#ctxbrew`, ensure `.ctxbrew` is in package `files`, set `scripts.prepack` to run `ctxb build`, and add `.ctxbrew/` to `.gitignore`.

### `ctxb build [--version SEMVER] [--dry-run] [--cwd DIR]`

Collect files from `ctxbrew.cli` and write package artifacts into `.ctxbrew/` in the project root.

### `ctxb get <name> [section]`

Primary read command.

- Without `section`: list sections from `.ctxbrew/manifest.json`.
- With `section`: stream section output.
- Package resolution uses `require.resolve("<name>/package.json")` from current working directory and then reads `<packageDir>/.ctxbrew`.

Flags:

| Flag                | Default   | Effect                                                 |
| ------------------- | --------- | ------------------------------------------------------ |
| `--json`            | off       | Structured JSON output                                 |
| `--files-only`      | off       | Only file paths                                        |
| `--max-bytes <n>`   | unlimited | Output cap (`200k`, `5m`)                              |
| `--grep <regex>`    | none      | Filter files by path regex                             |

### `ctxb completion <bash|zsh|fish>`

Print completion script.

## Storage Layout

- Publisher output inside your package root:
  - `.ctxbrew/manifest.json`
  - `.ctxbrew/files/<relative-source-path>`
- Installed package layout in consumer project:
  - `node_modules/<name>/.ctxbrew/manifest.json`
  - `node_modules/<name>/.ctxbrew/files/<relative-source-path>`

## npm publish integration

- `ctxb build` prepares `.ctxbrew` locally.
- npm includes `.ctxbrew` in the package tarball via `package.json#files`.
- `prepack` runs before `npm pack` and `npm publish`, so `ctxb build` regenerates artifacts automatically.

## Exit Codes

- `0`: success
- `1`: usage error
- `2`: config validation error
- `3`: package metadata/read error
- `4`: package/section/file not found
- `5`: reserved

## AI-Agent Usage Snippet

Use this workflow in your agent skill:

1. `ctxb get <name>` to list sections.
2. `ctxb get <name> <section> --max-bytes 200k` for context.
3. Use `--json` if structured parsing is needed.
4. Treat non-zero exit codes as failures (`4` means missing package/section).

## Ecosystem Scope

- JS ecosystem (`package.json`, npm install flow)
- Go ecosystem
- Rust ecosystem

## Architecture (High Level)

```text
publisher project                    npm                              consumer project
-----------------                    ---                              ----------------
ctxb build ---------------------->   npm publish / npm install ----> node_modules/<name>/.ctxbrew/...
  writes .ctxbrew/manifest.json                                        |
  writes .ctxbrew/files/*                                              v
                                                           ctxb get <name> [section]
                                                           resolve installed package
                                                           read .ctxbrew manifest/files
                                                           render markdown/json/files-only -> stdout
```

## Contributing

Releases are automated via `semantic-release` on every push to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions and the release pipeline.