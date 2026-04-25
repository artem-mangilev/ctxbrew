export const CURRENT_PROTOCOL_VERSION = 1;
export const MIN_SUPPORTED_PROTOCOL_VERSION = 1;

export const isSupportedProtocolVersion = (version: number): boolean => {
  return Number.isInteger(version) && version >= MIN_SUPPORTED_PROTOCOL_VERSION && version <= CURRENT_PROTOCOL_VERSION;
};
