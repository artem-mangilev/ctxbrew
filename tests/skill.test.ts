import { describe, expect, test } from "bun:test";
import { runSkill } from "../src/cli/skill.ts";
import { captureStdout } from "./helpers.ts";

describe("skill", () => {
  test("renders skill markdown", async () => {
    const output = await captureStdout(async () => {
      await runSkill({ agent: "cursor" });
    });
    expect(output).toContain("ctxbrew list");
    expect(output).toContain("ctxbrew get <package> <slice-id>");
  });
});
