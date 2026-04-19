export const MANIFEST_SCHEMA_VERSION = 1;

export type ManifestSection = {
  files: string[];
};

export type Manifest = {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  name: string;
  version: string;
  publishedAt: string;
  payload: {
    sha256: string;
    bytes: number;
  };
  sections: Record<string, ManifestSection>;
};

export type RegistryEntry = {
  name: string;
  versions: string[];
  latest: string | null;
};

export type PublishInput = {
  manifest: Manifest;
  payload: Uint8Array;
};
