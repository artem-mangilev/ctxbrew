import { configError } from "../utils/exit.ts";
import type { CtxbrewConfig } from "./config.ts";

const SUSPICIOUS_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /<\|endoftext\|>/i,
  /\b(?:curl|eval|execute|rm\s+-rf|powershell)\b/i,
];

export const validateConfigForBuild = (config: CtxbrewConfig): void => {
  for (const slice of config.slices) {
    if (slice.include.length === 0) {
      throw configError(`Slice "${slice.id}" must have at least one include pattern`);
    }
  }
};

export const assertNoPromptInjection = (path: string, content: string): void => {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      throw configError(
        `Potential prompt-injection pattern found in ${path}`,
        "Review package context content and remove suspicious instructions.",
      );
    }
  }
  const commandMentions = content.match(/\b(?:execute|curl|eval)\b/gi)?.length ?? 0;
  const words = content.match(/\b\w+\b/g)?.length ?? 1;
  if (words > 0 && commandMentions / words > 0.04 && commandMentions >= 3) {
    throw configError(
      `High density of command-like prompt-injection terms found in ${path}`,
      "Review package context content and remove suspicious instructions.",
    );
  }
};
