import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runSetup } from "../src/cli/setup.ts";
import { withTmpDir } from "./helpers.ts";

describe("setup", () => {
  test("writes skills into current repository root", async () => {
    await withTmpDir(async (root) => {
      await mkdir(join(root, ".git"), { recursive: true });
      const nested = join(root, "packages/web");
      await mkdir(nested, { recursive: true });

      await runSetup({ cwd: nested });

      expect(await Bun.file(join(root, ".claude/skills/ctxbrew/SKILL.md")).exists()).toBe(true);
      expect(await Bun.file(join(root, ".agents/skills/ctxbrew/SKILL.md")).exists()).toBe(true);
      expect(await Bun.file(join(nested, ".claude/skills/ctxbrew/SKILL.md")).exists()).toBe(false);
      expect(await Bun.file(join(nested, ".agents/skills/ctxbrew/SKILL.md")).exists()).toBe(false);
    });
  });

  test("falls back to cwd when no git repository is found", async () => {
    await withTmpDir(async (cwd) => {
      await runSetup({ cwd });
      expect(await Bun.file(join(cwd, ".claude/skills/ctxbrew/SKILL.md")).exists()).toBe(true);
      expect(await Bun.file(join(cwd, ".agents/skills/ctxbrew/SKILL.md")).exists()).toBe(true);
    });
  });
});
