/**
 * Token types.
 * JWT tokens for room access with claims for authorization.
 */

export type UserRole = 'host' | 'participant' | 'viewer';

export interface TokenClaims {
  /** Unique token identifier for revocation */
  jti: string;
  /** Tenant identifier */
  appId: string;
  /** Room identifier */
  roomId: string;
  /** User identifier (provided by tenant) */
  userId: string;
  /** User role in the room */
  role: UserRole;
}

export interface TokenPayload extends TokenClaims {
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

export interface CreateTokenInput {
  userId: string;
  role: UserRole;
  expiresIn?: string;
}

export interface CreateTokenResponse {
  token: string;
  expiresAt: string;
}
