/**
 * App (Tenant) routes.
 * Fastify routes for app management.
 *
 * Requirements:
 * - POST /apps - Creates a new app, generates appId and appSecret
 * - GET /apps - Lists all apps (without secrets)
 * - GET /apps/:appId - Gets a single app (without secret)
 * - No authentication required for now
 *
 * Coding rules:
 * - No business logic in routes
 * - Validate all inputs
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createAppSchema, getAppSchema, listAppsSchema } from './app.schema';
import { createApp, getAppById, listApps } from './app.service';
import type { CreateAppInput } from './app.types';

interface GetAppParams {
  appId: string;
}

export async function appRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /apps
   * Creates a new app (tenant).
   * Returns the app with its secret (only time secret is returned).
   */
  fastify.post<{ Body: CreateAppInput }>(
    '/apps',
    { schema: createAppSchema },
    async (request: FastifyRequest<{ Body: CreateAppInput }>, reply: FastifyReply) => {
      const app = await createApp(request.body);
      return reply.status(201).send(app);
    }
  );

  /**
   * GET /apps
   * Lists all apps (without secrets).
   */
  fastify.get(
    '/apps',
    { schema: listAppsSchema },
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      return listApps();
    }
  );

  /**
   * GET /apps/:appId
   * Gets a single app by ID (without secret).
   */
  fastify.get<{ Params: GetAppParams }>(
    '/apps/:appId',
    { schema: getAppSchema },
    async (request: FastifyRequest<{ Params: GetAppParams }>, _reply: FastifyReply) => {
      return getAppById(request.params.appId);
    }
  );
}
