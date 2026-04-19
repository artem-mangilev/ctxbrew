import type { Manifest, PublishInput, RegistryEntry } from "./types.ts";

export interface RegistryClient {
  resolveVersion(name: string, range: string): Promise<string>;
  publish(input: PublishInput): Promise<void>;
  fetchManifest(name: string, version: string): Promise<Manifest>;
  fetchPayload(name: string, version: string): Promise<Uint8Array>;
  list(): Promise<RegistryEntry[]>;
  listVersions(name: string): Promise<string[]>;
  describe(): string;
}
