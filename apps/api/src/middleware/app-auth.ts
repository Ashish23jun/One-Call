/**
 * App Authentication Middleware Plugin.
 * Centralizes tenant authentication for all protected routes.
 *
 * Usage:
 * 1. Register this plugin on protected routes
 * 2. Access authenticated app via request.app
 *
 * Headers required:
 * - x-app-id: The tenant's app ID
 * - x-app-secret: The tenant's app secret
 *
 * Coding rules:
 * - No business logic here
 * - Only authentication, not authorization
 * - Fail fast with clear errors
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { UnauthorizedError } from '../shared/errors';
import { validateAppCredentials } from '../modules/app';
import type { App } from '../modules/app';

/**
 * Extends FastifyRequest to include authenticated app.
 */
declare module 'fastify' {
  interface FastifyRequest {
    app: App;
  }
}

/**
 * App authentication options.
 */
export interface AppAuthOptions {
  /** Skip authentication for specific routes */
  skip?: (request: FastifyRequest) => boolean;
}

/**
 * App authentication plugin.
 * Validates x-app-id and x-app-secret headers and attaches the app to the request.
 */
async function appAuthPlugin(
  fastify: FastifyInstance,
  _options: AppAuthOptions
): Promise<void> {
  // Decorate request with app property (undefined by default)
  fastify.decorateRequest('app', undefined as unknown as App);

  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const appId = request.headers['x-app-id'];
      const appSecret = request.headers['x-app-secret'];

      // Validate headers exist
      if (!appId || typeof appId !== 'string') {
        throw new UnauthorizedError('Missing x-app-id header');
      }

      if (!appSecret || typeof appSecret !== 'string') {
        throw new UnauthorizedError('Missing x-app-secret header');
      }

      // Validate credentials
      const app = await validateAppCredentials(appId, appSecret);

      if (!app) {
        throw new UnauthorizedError('Invalid app credentials');
      }

      // Attach app to request
      request.app = app;
    }
  );
}

/**
 * Export as Fastify plugin with proper encapsulation.
 */
export const appAuth = fp(appAuthPlugin, {
  name: 'app-auth',
  fastify: '5.x',
});

/**
 * Type guard to check if request has authenticated app.
 */
export function hasAuthenticatedApp(request: FastifyRequest): request is FastifyRequest & { app: App } {
  return request.app !== null && request.app !== undefined;
}
