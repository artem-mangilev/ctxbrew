# Contributing

## Development

```bash
bun install
bun run dev -- --help        # run CLI from source (Bun)
bun test
bun run typecheck
bun run build                # build all 5 platform binaries into dist/
bun run build darwin-arm64   # build only one platform
```

`bin/ctxb.js` is a thin Node launcher that spawns the correct `dist/ctxb-<platform>-<arch>` binary. The real CLI lives in `src/` and is compiled with `bun build --compile`.

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). `semantic-release` derives the next version from commit subjects:


| Prefix                                                                             | Bump       |
| ---------------------------------------------------------------------------------- | ---------- |
| `fix:`                                                                             | patch      |
| `feat:`                                                                            | minor      |
| `feat!:` / `BREAKING CHANGE:`                                                      | major      |
| `chore:` / `docs:` / `refactor:` / `test:` / `ci:` / `build:` / `perf:` / `style:` | no release |


Examples:

```
feat(publish): support --tag for dist-tags
fix(get): handle missing .ctxbrew metadata in node_modules package
docs: clarify prepack integration for ctxb publish
```

Breaking changes:

```
feat!: drop Node 18 support

BREAKING CHANGE: minimum Node version is now 20.
```

## Release flow

Releases are fully automated by `.github/workflows/release.yml` on every push to `main`.

Pipeline:

1. `bun install --frozen-lockfile` → `bun run typecheck` → `bun test`
2. `bun run build` produces all 5 platform binaries in `dist/`.
3. `npx semantic-release` analyzes commit history, bumps `package.json#version`, updates `CHANGELOG.md`, publishes to npm, creates a GitHub Release with the binaries as assets, and pushes the release commit back to `main`.

### Required GitHub repository setup

- **Secret `NPM_TOKEN`**: [Automation access token](https://docs.npmjs.com/creating-and-viewing-access-tokens) for the `ctxbrew` package. Settings → Secrets and variables → Actions → New repository secret.
- **Workflow permissions**: Settings → Actions → General → Workflow permissions = "Read and write permissions" (or rely on the explicit `permissions:` block in `release.yml`).
- **Branch protection on `main`**: if you enable "Require a pull request before merging" with required reviews, either
  - use a [Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with `contents: write` stored as `GH_TOKEN`/`GITHUB_TOKEN`, **or**
  - add `[skip ci]` to the release commit (already configured) and allow the bot/app that runs Actions to push to `main`.

### First release

`semantic-release` ignores `package.json#version` and computes the next version from git tags + commit history.

- If there are no git tags yet, the first release will be `1.0.0` by default. To start from `0.1.0` or similar, create the tag locally once:
  ```bash
  git tag v0.1.0 && git push origin v0.1.0
  ```
  Subsequent runs will bump from that tag based on commit messages.
- To see what would happen without publishing: `npx semantic-release --dry-run --no-ci` locally.

### CI on pull requests

`.github/workflows/ci.yml` runs only `typecheck` + `test` on pull requests and feature branches. Builds of platform binaries happen only in the release job.