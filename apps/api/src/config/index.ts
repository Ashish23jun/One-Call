/**
 * Application configuration.
 * Centralized config for the API server.
 *
 * Environment variables:
 * - PORT: Server port (default: 3000)
 * - HOST: Server host (default: 0.0.0.0)
 * - DATABASE_URL: PostgreSQL connection string
 * - JWT_SECRET: Secret for signing JWTs
 * - JWT_EXPIRES_IN: Default JWT expiration (default: 1h)
 * - NODE_ENV: Environment (development | production)
 */

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rtc_platform?schema=public',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'rtc-platform-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  env: process.env.NODE_ENV || 'development',
} as const;

export type Config = typeof config;

/**
 * Validates required environment variables.
 * Throws if critical config is missing in production.
 */
export function validateConfig(): void {
  if (config.env === 'production') {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required in production');
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
  }
}
