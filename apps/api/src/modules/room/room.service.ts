/**
 * Room service.
 * Business logic functions for room management using Prisma.
 *
 * Coding rules:
 * - No any or unknown
 * - Prefer explicit types
 * - Services contain logic, routes are thin
 * - Validate all inputs
 * - Throw typed errors
 */

import { prisma } from '../../database';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors';
import type { Room, CreateRoomInput, CreateRoomResponse, GetRoomResponse } from './room.types';

const DEFAULT_MAX_PARTICIPANTS = 2;
const MAX_PARTICIPANTS_LIMIT = 1000;

/**
 * Creates a new room for an app.
 */
export async function createRoom(
  appId: string,
  input: CreateRoomInput
): Promise<CreateRoomResponse> {
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError('Room name is required');
  }

  if (!appId) {
    throw new ValidationError('App ID is required');
  }

  const maxParticipants = input.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS;

  if (maxParticipants < 1 || maxParticipants > MAX_PARTICIPANTS_LIMIT) {
    throw new ValidationError(`Max participants must be between 1 and ${MAX_PARTICIPANTS_LIMIT}`);
  }

  const room = await prisma.room.create({
    data: {
      name: input.name.trim(),
      maxParticipants,
      appId,
    },
  });

  return {
    id: room.id,
    appId: room.appId,
    name: room.name,
    maxParticipants: room.maxParticipants,
    createdAt: room.createdAt.toISOString(),
  };
}

/**
 * Gets a room by ID, scoped to an app.
 */
export async function getRoomById(appId: string, roomId: string): Promise<GetRoomResponse> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new NotFoundError('Room', roomId);
  }

  // Ensure room belongs to the requesting app
  if (room.appId !== appId) {
    throw new ForbiddenError('Room does not belong to this app');
  }

  return {
    id: room.id,
    appId: room.appId,
    name: room.name,
    maxParticipants: room.maxParticipants,
    createdAt: room.createdAt.toISOString(),
  };
}

/**
 * Lists all rooms for an app.
 */
export async function listRoomsByAppId(appId: string): Promise<GetRoomResponse[]> {
  const rooms = await prisma.room.findMany({
    where: { appId },
    orderBy: { createdAt: 'desc' },
  });

  return rooms.map((room) => ({
    id: room.id,
    appId: room.appId,
    name: room.name,
    maxParticipants: room.maxParticipants,
    createdAt: room.createdAt.toISOString(),
  }));
}

/**
 * Checks if a room exists and belongs to an app.
 */
export async function roomExistsForApp(appId: string, roomId: string): Promise<boolean> {
  const count = await prisma.room.count({
    where: {
      id: roomId,
      appId,
    },
  });

  return count > 0;
}

/**
 * Gets a room without app validation (internal use only).
 */
export async function getRoomInternal(roomId: string): Promise<Room | null> {
  return prisma.room.findUnique({
    where: { id: roomId },
  });
}

/**
 * Deletes a room (for an app).
 */
export async function deleteRoom(appId: string, roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new NotFoundError('Room', roomId);
  }

  if (room.appId !== appId) {
    throw new ForbiddenError('Room does not belong to this app');
  }

  await prisma.room.delete({
    where: { id: roomId },
  });
}
