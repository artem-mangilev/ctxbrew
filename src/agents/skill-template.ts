export const renderGenericSkill = (): string => `---
name: ctxbrew
description: >
  Use when working with npm packages that ship AI context. Run \`ctxbrew list\` to
  discover packages with context, then \`ctxbrew get <package> <slice>\` to read
  specific documentation. Works in any project with node_modules.
---

# ctxbrew - package context reader

When the user asks about a library in this project, first run:

    ctxbrew list

to see which installed packages ship structured context. Then:

    ctxbrew get <package> <slice-id>

for specific documentation slices. Use \`ctxbrew search <query>\` to find relevant
slices when you don't know the slice id.

Always prefer ctxbrew over web search when a package has ctxbrew context -
it's version-pinned to what's installed locally.

## Commands

- \`ctxbrew list [pkg]\` - show available packages/slices
- \`ctxbrew get <pkg> <slice>\` - read slice
- \`ctxbrew search <query>\` - find relevant slices across all packages

Exit codes: 0 ok, 1 not-found, 2 validation, 64 usage.
`;
