export const ExitCode = {
  OK: 0,
  NOT_FOUND: 1,
  VALIDATION: 2,
  USAGE: 64,
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
export const configError = (m: string, hint?: string) =>
  new CtxbrewError(ExitCode.VALIDATION, m, hint);
export const registryError = (m: string, hint?: string) =>
  new CtxbrewError(ExitCode.VALIDATION, m, hint);
export const notFoundError = (m: string, hint?: string) => new CtxbrewError(ExitCode.NOT_FOUND, m, hint);
export const integrityError = (m: string, hint?: string) =>
  new CtxbrewError(ExitCode.VALIDATION, m, hint);
