/**
 * App (Tenant) service.
 * Business logic functions for app management using Prisma.
 *
 * Coding rules:
 * - No any or unknown
 * - Prefer explicit types
 * - Services contain logic, routes are thin
 * - Validate all inputs
 * - Throw typed errors
 */

import { prisma } from '../../database';
import { generateSecret } from '../../shared/utils';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { App, CreateAppInput, CreateAppResponse, GetAppResponse } from './app.types';

/**
 * Creates a new app (tenant).
 * Generates a unique appSecret.
 */
export async function createApp(input: CreateAppInput): Promise<CreateAppResponse> {
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError('App name is required');
  }

  const app = await prisma.app.create({
    data: {
      name: input.name.trim(),
      secret: generateSecret(),
    },
  });

  return {
    id: app.id,
    name: app.name,
    secret: app.secret,
    createdAt: app.createdAt.toISOString(),
  };
}

/**
 * Gets an app by ID (without secret).
 */
export async function getAppById(appId: string): Promise<GetAppResponse> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
  });

  if (!app) {
    throw new NotFoundError('App', appId);
  }

  return {
    id: app.id,
    name: app.name,
    createdAt: app.createdAt.toISOString(),
  };
}

/**
 * Gets all apps (without secrets).
 */
export async function listApps(): Promise<GetAppResponse[]> {
  const apps = await prisma.app.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return apps.map((app) => ({
    id: app.id,
    name: app.name,
    createdAt: app.createdAt.toISOString(),
  }));
}

/**
 * Validates app credentials.
 * Returns the app if valid, null otherwise.
 */
export async function validateAppCredentials(
  appId: string,
  appSecret: string
): Promise<App | null> {
  const app = await prisma.app.findFirst({
    where: {
      id: appId,
      secret: appSecret,
    },
  });

  return app;
}

/**
 * Checks if an app exists.
 */
export async function appExists(appId: string): Promise<boolean> {
  const count = await prisma.app.count({
    where: { id: appId },
  });

  return count > 0;
}

/**
 * Gets an app by ID (internal use, includes all fields).
 */
export async function getAppInternal(appId: string): Promise<App | null> {
  return prisma.app.findUnique({
    where: { id: appId },
  });
}
