export const MAX_ROLE_LENGTH = 100;
const ROLE_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;

export const isValidRoleTag = (role: string): boolean => {
  const trimmed = role.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_ROLE_LENGTH &&
    ROLE_PATTERN.test(trimmed)
  );
};

export const isValidPubkey = (pubkey: string): boolean =>
  pubkey.length === 64 && /^[0-9a-fA-F]+$/.test(pubkey);

export const isValidHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const isValidRelayUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['ws:', 'wss:'].includes(parsed.protocol) && parsed.hostname.length > 0;
  } catch {
    return false;
  }
};
