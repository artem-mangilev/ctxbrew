# ctxbrew

`ctxbrew` packages repo context into versioned markdown slices and reads those slices from installed npm dependencies.

## Install

```bash
npm install -g ctxbrew
ctxbrew --version
```

## Author workflow

Initialize config and publish wiring:

```bash
ctxbrew init
```

This creates `ctxbrew.yaml`.

Build artifacts:

```bash
ctxbrew build
```

Validate without writing files:

```bash
ctxbrew build --check
```

Generated files:

- `ctxbrew/index.yaml`
- `ctxbrew/<slice-id>.md`

## Consumer workflow

Discover installed packages with context:

```bash
ctxbrew list
ctxbrew list @acme/ui
```

Read one slice:

```bash
ctxbrew get @acme/ui components
```

Search across slices:

```bash
ctxbrew search "dialog focus trap"
ctxbrew search "theming" --limit 5
```

## Config format (`ctxbrew.yaml`)

```yaml
version: 1
slices:
  - id: overview
    description: High-level architecture
    include:
      - README.md
  - id: components
    title: Components
    description: UI components and usage
    compress: true
    include:
      - src/components/**
      - docs/components/**
```

Rules:

- `version` is required and currently must be `1`.
- `id` must be unique kebab-case.
- `include` is required and non-empty.
- `compress` is optional and defaults to `false`; when enabled, JS/TS files are reduced to top-level signatures.
- Overlap policy: first matching slice owns the file.

## Setup for agents

```bash
ctxbrew setup
ctxbrew skill
```

## Exit codes

- `0` success
- `1` not found
- `2` validation error
- `64` usage error

