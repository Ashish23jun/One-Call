/**
 * Room routes.
 * Fastify routes for room management.
 *
 * Requirements:
 * - POST /rooms - Creates a new room (requires app authentication)
 * - GET /rooms - Lists all rooms for the app
 * - GET /rooms/:roomId - Gets a single room
 * - Authentication handled by appAuth middleware
 *
 * Coding rules:
 * - No business logic in routes
 * - Validate all inputs
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { appAuth } from '../../middleware';
import { createRoomSchema, getRoomSchema, listRoomsSchema } from './room.schema';
import { createRoom, getRoomById, listRoomsByAppId } from './room.service';
import type { CreateRoomInput } from './room.types';

interface GetRoomParams {
  roomId: string;
}

export async function roomRoutes(fastify: FastifyInstance): Promise<void> {
  // Register app auth middleware for all routes in this plugin
  await fastify.register(appAuth);

  /**
   * POST /rooms
   * Creates a new room for the authenticated app.
   */
  fastify.post<{ Body: CreateRoomInput }>(
    '/rooms',
    { schema: createRoomSchema },
    async (request: FastifyRequest<{ Body: CreateRoomInput }>, reply: FastifyReply) => {
      const room = await createRoom(request.app.id, request.body);
      return reply.status(201).send(room);
    }
  );

  /**
   * GET /rooms
   * Lists all rooms for the authenticated app.
   */
  fastify.get(
    '/rooms',
    { schema: listRoomsSchema },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      return listRoomsByAppId(request.app.id);
    }
  );

  /**
   * GET /rooms/:roomId
   * Gets a single room by ID.
   */
  fastify.get<{ Params: GetRoomParams }>(
    '/rooms/:roomId',
    { schema: getRoomSchema },
    async (request: FastifyRequest<{ Params: GetRoomParams }>, _reply: FastifyReply) => {
      return getRoomById(request.app.id, request.params.roomId);
    }
  );
}
