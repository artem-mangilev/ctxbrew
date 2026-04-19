import { registryError } from "../utils/exit.ts";
import { MANIFEST_SCHEMA_VERSION, type Manifest } from "./types.ts";

export const validateManifest = (raw: unknown, name: string, version: string): Manifest => {
  if (typeof raw !== "object" || raw === null) {
    throw registryError(`Manifest for ${name}@${version} is not an object`);
  }
  const m = raw as Manifest;
  if (m.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw registryError(
      `Manifest schemaVersion ${m.schemaVersion} for ${name}@${version} is not supported (expected ${MANIFEST_SCHEMA_VERSION})`,
    );
  }
  if (m.name !== name || m.version !== version) {
    throw registryError(
      `Manifest mismatch: file says ${m.name}@${m.version}, expected ${name}@${version}`,
    );
  }
  if (!m.payload || typeof m.payload.sha256 !== "string" || typeof m.payload.bytes !== "number") {
    throw registryError(`Manifest for ${name}@${version} has invalid payload metadata`);
  }
  if (!m.sections || typeof m.sections !== "object") {
    throw registryError(`Manifest for ${name}@${version} has no sections`);
  }
  return m;
};
