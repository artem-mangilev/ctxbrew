import { join } from "node:path";
import { z } from "zod";
import { CURRENT_PROTOCOL_VERSION } from "./protocol.ts";
import { parseYamlFile } from "./yaml.ts";
import { configError } from "../utils/exit.ts";

const SLICE_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CtxbrewSliceSchema = z.object({
  id: z.string().regex(SLICE_ID_RE, "Slice id must be kebab-case"),
  title: z.string().min(1).optional(),
  description: z.string().min(1),
  include: z.array(z.string().min(1)).min(1),
  compress: z.boolean().optional(),
});

export const CtxbrewConfigSchema = z.object({
  version: z.number().int().positive(),
  slices: z.array(CtxbrewSliceSchema).min(1),
});

export type CtxbrewSlice = z.infer<typeof CtxbrewSliceSchema>;
export type CtxbrewConfig = z.infer<typeof CtxbrewConfigSchema>;

export type LoadedConfig = {
  config: CtxbrewConfig;
  configPath: string;
};

export const titleFromId = (id: string): string =>
  id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const loadCtxbrewConfig = async (cwd: string): Promise<LoadedConfig> => {
  const configPath = join(cwd, "ctxbrew.yaml");
  const raw = await parseYamlFile<unknown>(configPath);
  const parsed = CtxbrewConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw configError(`Invalid ctxbrew.yaml:\n${issues}`);
  }
  if (parsed.data.version !== CURRENT_PROTOCOL_VERSION) {
    throw configError(
      `ctxbrew.yaml version ${parsed.data.version} is not supported`,
      `Use version: ${CURRENT_PROTOCOL_VERSION}.`,
    );
  }
  const ids = new Set<string>();
  for (const slice of parsed.data.slices) {
    if (ids.has(slice.id)) {
      throw configError(`Duplicate slice id "${slice.id}" in ctxbrew.yaml`);
    }
    ids.add(slice.id);
  }
  return { config: parsed.data, configPath };
};
