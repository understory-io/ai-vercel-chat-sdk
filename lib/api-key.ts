import crypto from 'node:crypto';

const API_KEY_PREFIX = 'sk_';
const RANDOM_LENGTH = 45;

/** Generate a cryptographically random API key */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return API_KEY_PREFIX + randomBytes.toString('base64url').slice(0, RANDOM_LENGTH);
}

/** Hash an API key with SHA-256 for storage */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Extract prefix for display purposes */
export function getKeyPrefix(key: string): string {
  return key.slice(0, 8);
}
