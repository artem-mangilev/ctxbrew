import { configError } from "../utils/exit.ts";
import type { CtxbrewConfig } from "./config.ts";

const SUSPICIOUS_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /<\|endoftext\|>/i,
  /\b(?:curl|eval|rm\s+-rf|powershell)\b/i,
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
};
