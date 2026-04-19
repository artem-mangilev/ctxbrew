import { z } from "zod";

export const PACKAGE_NAME_RE = /^[a-z0-9][a-z0-9._~-]*$/;
export const SECTION_NAME_RE = /^[a-z][a-z0-9-]*$/;

const PatternSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);

const SectionsSchema = z
  .record(z.string(), PatternSchema)
  .refine(
    (sections) => Object.keys(sections).every((k) => SECTION_NAME_RE.test(k)),
    {
      message: `Section names must match ${SECTION_NAME_RE}`,
    },
  )
  .refine((sections) => Object.keys(sections).length > 0, {
    message: "At least one section is required under `cli`",
  });

export const CtxbrewConfigSchema = z
  .object({
    cli: SectionsSchema,
  })
  .strict();

export type CtxbrewConfig = z.infer<typeof CtxbrewConfigSchema>;

export type ResolvedConfig = {
  name: string;
  version: string;
  cli: Record<string, string[]>;
};
