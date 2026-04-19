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

This adds `ctxbrew` section to your `package.json`:

```json
{
    "name": "my-library",
    "version": "0.1.0",
    "ctxbrew": {
        "cli": {
            "docs": "./docs/**/*.md",
            "api": ["./src/**/*.ts", "!**/*.test.ts"]
        }
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

Create/update starter `package.json#ctxbrew`.

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

## Registry Backends

Select the backend via `CTXBREW_REGISTRY`:

- `local` (default): on-disk registry under `~/.ctxbrew/registry/`.
- `github`: [GitHub Releases](https://docs.github.com/en/repos/releases) as the registry. Each `<name>@<version>` is a GitHub Release tagged `<name>-<version>` with `manifest.json` and `payload.tar.gz` as assets.

Required env for `github`:

| Variable                   | Required                | Purpose                                                |
| -------------------------- | ----------------------- | ------------------------------------------------------ |
| `CTXBREW_GITHUB_REPO`      | yes                     | `owner/repo` that stores the registry                  |
| `CTXBREW_GITHUB_TOKEN`     | for publish / private   | Falls back to `GH_TOKEN`, then `GITHUB_TOKEN`          |
| `CTXBREW_GITHUB_API_BASE`  | no                      | GitHub Enterprise API base (default `https://api.github.com`) |
| `CTXBREW_GITHUB_UPLOAD_BASE` | no                    | GHE upload base (default `https://uploads.github.com`) |

Example:

```bash
export CTXBREW_REGISTRY=github
export CTXBREW_GITHUB_REPO=my-org/ctxbrew-registry
export CTXBREW_GITHUB_TOKEN=ghp_xxx
ctxb publish
ctxb get my-library
```

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

## Ecosystem Scope

- JS ecosystem (`package.json`, npm install flow)
- Go ecosystem
- Rust ecosystem

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

## Contributing

Releases are automated via `semantic-release` on every push to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions and the release pipeline.