# ctxbrew

`ctxbrew` packages library docs/source into versioned context bundles for AI agents.

Install package `ctxbrew`, run command `ctxb`.

```bash
ctxb get react components
```

## What It Does

- Reads `ctxbrew` config from a library repo.
- Resolves glob sections at publish time.
- Produces a manifest + compressed payload with SHA256 integrity.
- Lets consumers read sections as markdown, JSON, or files-only.
- Keeps stdout stable for piping into agents; logs go to stderr.

## Install

### From source

```bash
git clone https://github.com/<org>/ctxbrew
cd ctxbrew
bun install
bun run build:darwin-arm64
./dist/ctxb-darwin-arm64 --version
```

### Run directly (Bun >= 1.3.6)

```bash
bun run ./src/bin/ctxb.ts --help
```

## Quick Start

```bash
ctxb init
```

This creates `ctxbrew.config.json`:

```json
{
    "name": "my-library",
    "version": "0.1.0",
    "cli": {
        "docs": "./docs/**/*.md",
        "api": ["./src/**/*.ts", "!**/*.test.ts"]
    }
}
```

Publish:

```bash
ctxb publish
```

Read:

```bash
ctxb get my-library
ctxb get my-library docs
ctxb get my-library api --json
ctxb get my-library docs --files-only
```

## Config Discovery

Order:

1. `ctxbrew.config.json`
2. `.ctxbrewrc.json`
3. `.ctxbrewrc` (JSON content)
4. `package.json#ctxbrew`

Example:

```json
{
    "name": "react",
    "version": "19.0.0",
    "cli": {
        "components": "./docs/components/**",
        "directives": "./docs/directives/**",
        "api": ["./src/**/*.ts", "!**/*.test.ts"]
    },
    "limits": {
        "maxBytes": 52428800,
        "maxFiles": 5000
    },
    "extensions": {
        ".astro": "astro"
    }
}
```

## CLI

### `ctxb init [--cwd DIR] [--force]`

Create starter `ctxbrew.config.json`.

### `ctxb publish [--version SEMVER] [--dry-run] [--cwd DIR]`

Pack and publish to registry.

### `ctxb install <name>[@<range>] [--no-cache]`

Pre-fetch package into local cache.

### `ctxb list [--json]`

List packages in local registry.

### `ctxb info <name> [--version <range>] [--json]`

Show manifest metadata.

### `ctxb get <name> [section]`

Primary read command.

- Without `section`: list sections from manifest (no payload fetch).
- With `section`: stream section output.

Flags:

| Flag                | Default   | Effect                                                 |
| ------------------- | --------- | ------------------------------------------------------ |
| `--version <range>` | `latest`  | Semver range/exact, fallback `$CTXBREW_<NAME>_VERSION` |
| `--json`            | off       | Structured JSON output                                 |
| `--files-only`      | off       | Only file paths                                        |
| `--no-cache`        | off       | Re-fetch payload                                       |
| `--max-bytes <n>`   | unlimited | Output cap (`200k`, `5m`)                              |
| `--grep <regex>`    | none      | Filter files by path regex                             |

### `ctxb cache clear [name]` / `ctxb cache prune`

Clear or prune local cache.

### `ctxb completion <bash|zsh|fish>`

Print completion script.

## Storage Layout

- Registry: `~/.ctxbrew/registry/<name>/<version>/`
    - `manifest.json`
    - `payload.tar.gz`
- Cache: `~/.ctxbrew/cache/<name>/<version>/`

Override root with `CTXBREW_HOME`.

## Exit Codes

| Code | Meaning                   |
| ---- | ------------------------- |
| 0    | Success                   |
| 1    | Usage error               |
| 2    | Config validation error   |
| 3    | Registry error            |
| 4    | Package/section not found |
| 5    | Integrity mismatch        |

## AI-Agent Usage Snippet

Use this workflow in your agent skill:

1. `ctxb get <name>` to list sections.
2. `ctxb get <name> <section> --max-bytes 200k` for context.
3. Use `--json` if structured parsing is needed.
4. Treat non-zero exit codes as failures (`4` means missing package/section).

## Cross-language Support

`ctxb` is a standalone binary and can be used from JS/TS, Go, Rust, Python, etc.

Auto-detection priority for missing `name`/`version`:

1. `package.json`
2. `Cargo.toml`
3. `go.mod` (module tail segment for `name`)

Otherwise set `name` and `version` explicitly in `ctxbrew.config.json`.

## Architecture (High Level)

```text
publisher                        registry                       consumer
---------                        --------                       --------
ctxb publish --pack-->           <name>/<ver>/manifest.json
                                 <name>/<ver>/payload.tar.gz
                                                               |
                                 <-- fetchManifest ----------  ctxb get <name> [section]
                                 -- fetchPayload ----------->  verify sha256 -> extract ~/.ctxbrew/cache
                                                               -> render markdown/json/files-only -> stdout
```

`manifest.json` is separate from payload, so listing sections is fast and payload-free.

## Project Layout

```text
src/
  bin/ctxb.ts
  cli/
  config/
  extract/
  archive/
  registry/
  cache/
  utils/
scripts/build.ts
tests/
```

## Development

```bash
bun install
bun test
bun run typecheck
bun run dev -- get demo
bun run build:darwin-arm64
```

## License

MIT
