import { configError } from "../utils/exit.ts";

export const parseYamlFile = async <T>(path: string): Promise<T> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw configError(`Missing file: ${path}`);
  }
  const text = await file.text();
  try {
    return Bun.YAML.parse(text) as T;
  } catch (error) {
    throw configError(`Invalid YAML at ${path}: ${(error as Error).message}`);
  }
};

export const stringifyYaml = (value: unknown): string => `${Bun.YAML.stringify(value)}`.trimEnd() + "\n";
