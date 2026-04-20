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
  if (!m.sections || typeof m.sections !== "object") {
    throw registryError(`Manifest for ${name}@${version} has no sections`);
  }
  for (const [sectionName, sectionValue] of Object.entries(m.sections)) {
    if (typeof sectionValue !== "object" || sectionValue === null || !("files" in sectionValue)) {
      throw registryError(`Manifest section "${sectionName}" is invalid`);
    }
    const files = (sectionValue as { files?: unknown }).files;
    if (!Array.isArray(files) || files.some((f) => typeof f !== "string")) {
      throw registryError(`Manifest section "${sectionName}" has invalid files list`);
    }
  }
  return m;
};
