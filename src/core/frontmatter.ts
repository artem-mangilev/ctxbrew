import { z } from "zod";
import { stringifyYaml } from "./yaml.ts";

export const FrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const renderFrontmatter = (value: Frontmatter): string => {
  const parsed = FrontmatterSchema.parse(value);
  return `---\n${stringifyYaml(parsed)}---\n`;
};
