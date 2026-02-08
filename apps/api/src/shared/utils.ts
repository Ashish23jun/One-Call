/**
 * Shared utility functions.
 */

import { randomBytes, randomUUID } from 'crypto';

/**
 * Generates a cryptographically secure random ID.
 */
export function generateId(prefix: string, length = 16): string {
  const bytes = randomBytes(length);
  const id = bytes.toString('hex');
  return `${prefix}_${id}`;
}

/**
 * Generates a cryptographically secure secret.
 */
export function generateSecret(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generates a unique JWT token identifier (jti).
 * Uses UUID v4 for uniqueness.
 * Used for future token revocation support.
 */
export function generateJti(): string {
  return randomUUID();
}
