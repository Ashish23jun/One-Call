/**
 * Token service.
 * Business logic functions for JWT token generation.
 *
 * Requirements:
 * - Issues short-lived JWT tokens
 * - Token must include jti, appId, roomId, userId, role, exp
 *
 * Coding rules:
 * - No any or unknown
 * - Prefer explicit types
 * - Services contain logic, routes are thin
 * - Validate all inputs
 * - Throw typed errors
 */

import * as jwt from 'jsonwebtoken';
import { config } from '../../config';
import { generateJti } from '../../shared/utils';
import { ValidationError, NotFoundError, ForbiddenError } from '../../shared/errors';
import { getRoomInternal } from '../room';
import type { CreateTokenInput, CreateTokenResponse, TokenClaims, UserRole } from './token.types';

const VALID_ROLES: UserRole[] = ['host', 'participant', 'viewer'];

/**
 * Parses an expiration string (e.g., "1h", "30m", "7d") to seconds.
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new ValidationError('Invalid expiresIn format. Use format like "1h", "30m", "7d"');
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new ValidationError('Invalid time unit');
  }
}

/**
 * Creates a JWT token for room access.
 */
export async function createToken(
  appId: string,
  roomId: string,
  input: CreateTokenInput
): Promise<CreateTokenResponse> {
  // Validate inputs
  if (!appId) {
    throw new ValidationError('App ID is required');
  }

  if (!roomId) {
    throw new ValidationError('Room ID is required');
  }

  if (!input.userId || input.userId.trim().length === 0) {
    throw new ValidationError('User ID is required');
  }

  if (!input.role || !VALID_ROLES.includes(input.role)) {
    throw new ValidationError(`Role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  // Verify room exists
  const room = await getRoomInternal(roomId);

  if (!room) {
    throw new NotFoundError('Room', roomId);
  }

  // Verify room belongs to the app
  if (room.appId !== appId) {
    throw new ForbiddenError('Room does not belong to this app');
  }

  // Parse expiration time
  const expiresIn = input.expiresIn || config.jwt.expiresIn;
  const expiresInSeconds = parseExpiresIn(expiresIn);

  // Calculate expiration timestamp
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  // Generate unique token ID for future revocation support
  const jti = generateJti();

  // Create token claims
  const claims: TokenClaims = {
    jti,
    appId,
    roomId,
    userId: input.userId.trim(),
    role: input.role,
  };

  // Sign the token
  const token = jwt.sign(claims, config.jwt.secret, {
    expiresIn: expiresInSeconds,
  });

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Verifies and decodes a JWT token.
 * Returns the token claims if valid, throws if invalid.
 */
export function verifyToken(token: string): TokenClaims {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as TokenClaims & { iat: number; exp: number };

    return {
      jti: decoded.jti,
      appId: decoded.appId,
      roomId: decoded.roomId,
      userId: decoded.userId,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ValidationError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ValidationError('Invalid token');
    }
    throw error;
  }
}
