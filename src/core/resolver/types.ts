import type { IndexManifest } from "../index-manifest.ts";

export type DiscoveredPackage = {
  name: string;
  packageRoot: string;
  indexPath: string;
  version: string;
  manifest: IndexManifest;
};

export type DiscoverProvider = (cwd: string) => Promise<string[]>;
