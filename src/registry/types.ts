export const MANIFEST_SCHEMA_VERSION = 1;

export type ManifestSection = {
  files: string[];
};

export type Manifest = {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  name: string;
  version: string;
  publishedAt: string;
  sections: Record<string, ManifestSection>;
};
