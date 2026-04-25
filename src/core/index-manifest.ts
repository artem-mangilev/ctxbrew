import { z } from "zod";
import { parseYamlFile, stringifyYaml } from "./yaml.ts";
import { registryError } from "../utils/exit.ts";

export const IndexSliceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  file: z.string().min(1),
});

export const IndexManifestSchema = z.object({
  version: z.number().int().positive(),
  slices: z.array(IndexSliceSchema),
});

export type IndexSlice = z.infer<typeof IndexSliceSchema>;
export type IndexManifest = z.infer<typeof IndexManifestSchema>;

export const readIndexManifest = async (path: string): Promise<IndexManifest> => {
  const raw = await parseYamlFile<unknown>(path);
  const parsed = IndexManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw registryError(`Invalid index manifest at ${path}: ${issues}`);
  }
  return parsed.data;
};

export const serializeIndexManifest = (manifest: IndexManifest): string => stringifyYaml(manifest);
