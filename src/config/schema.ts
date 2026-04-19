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

const LimitsSchema = z
  .object({
    maxBytes: z.number().int().positive().optional(),
    maxFiles: z.number().int().positive().optional(),
  })
  .optional();

const ExtensionsSchema = z.record(z.string(), z.string()).optional();

export const CtxbrewConfigSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(PACKAGE_NAME_RE, `Package name must match ${PACKAGE_NAME_RE}`)
    .optional(),
  version: z.string().min(1).optional(),
  cli: SectionsSchema,
  limits: LimitsSchema,
  extensions: ExtensionsSchema,
});

export type CtxbrewConfig = z.infer<typeof CtxbrewConfigSchema>;

export type ResolvedConfig = {
  name: string;
  version: string;
  cli: Record<string, string[]>;
  limits: { maxBytes: number; maxFiles: number };
  extensions: Record<string, string>;
};

export const DEFAULT_LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  maxFiles: 5000,
};
