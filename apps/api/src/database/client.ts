/**
 * Prisma database client singleton.
 * Ensures a single connection pool across the application.
 *
 * Coding rules:
 * - No any or unknown
 * - Prefer explicit types
 * - Clean separation of concerns
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Creates a new Prisma client with logging configuration.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });
}

/**
 * Singleton Prisma client instance.
 * In development, we store it in globalThis to prevent
 * multiple instances during hot reloading.
 */
export const prisma: PrismaClient = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Connects to the database.
 * Call this during server startup.
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

/**
 * Disconnects from the database.
 * Call this during graceful shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
