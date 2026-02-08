/**
 * App (Tenant) types.
 * Represents a SaaS customer in the multi-tenant RTC platform.
 *
 * Note: The App model is defined in Prisma schema.
 * These types are for API request/response shapes.
 */

import type { App as PrismaApp } from '@prisma/client';

// Re-export the Prisma App type for internal use
export type App = PrismaApp;

export interface CreateAppInput {
  name: string;
}

export interface CreateAppResponse {
  id: string;
  name: string;
  secret: string;
  createdAt: string;
}

export interface GetAppResponse {
  id: string;
  name: string;
  createdAt: string;
}

