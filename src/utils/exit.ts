export const ExitCode = {
  OK: 0,
  USAGE: 1,
  CONFIG: 2,
  REGISTRY: 3,
  NOT_FOUND: 4,
  INTEGRITY: 5,
} as const;

export type ExitCodeName = keyof typeof ExitCode;
export type ExitCodeValue = (typeof ExitCode)[ExitCodeName];

export class CtxbrewError extends Error {
  constructor(
    public readonly code: ExitCodeValue,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "CtxbrewError";
  }
}

export const usageError = (m: string, hint?: string) => new CtxbrewError(ExitCode.USAGE, m, hint);
export const configError = (m: string, hint?: string) => new CtxbrewError(ExitCode.CONFIG, m, hint);
export const registryError = (m: string, hint?: string) => new CtxbrewError(ExitCode.REGISTRY, m, hint);
export const notFoundError = (m: string, hint?: string) => new CtxbrewError(ExitCode.NOT_FOUND, m, hint);
export const integrityError = (m: string, hint?: string) => new CtxbrewError(ExitCode.INTEGRITY, m, hint);
