/**
 * Token routes.
 * Fastify routes for token generation.
 *
 * Requirements:
 * - POST /rooms/:roomId/token - Generates a JWT token for room access
 * - Authentication handled by appAuth middleware
 * - Token includes jti, appId, roomId, userId, role, exp
 *
 * Coding rules:
 * - No business logic in routes
 * - Validate all inputs
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { appAuth } from '../../middleware';
import { createTokenSchema } from './token.schema';
import { createToken } from './token.service';
import type { CreateTokenInput } from './token.types';

interface TokenParams {
  roomId: string;
}

export async function tokenRoutes(fastify: FastifyInstance): Promise<void> {
  // Register app auth middleware for all routes in this plugin
  await fastify.register(appAuth);

  /**
   * POST /rooms/:roomId/token
   * Generates a JWT token for room access.
   */
  fastify.post<{ Params: TokenParams; Body: CreateTokenInput }>(
    '/rooms/:roomId/token',
    { schema: createTokenSchema },
    async (
      request: FastifyRequest<{ Params: TokenParams; Body: CreateTokenInput }>,
      reply: FastifyReply
    ) => {
      const token = await createToken(request.app.id, request.params.roomId, request.body);
      return reply.status(201).send(token);
    }
  );
}
