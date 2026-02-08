/**
 * Room types.
 * Rooms belong to a single app (tenant) and represent a communication session.
 *
 * Note: The Room model is defined in Prisma schema.
 * These types are for API request/response shapes.
 */

import type { Room as PrismaRoom } from '@prisma/client';

// Re-export the Prisma Room type for internal use
export type Room = PrismaRoom;

export interface CreateRoomInput {
  name: string;
  maxParticipants?: number;
}

export interface CreateRoomResponse {
  id: string;
  appId: string;
  name: string;
  maxParticipants: number;
  createdAt: string;
}

export interface GetRoomResponse {
  id: string;
  appId: string;
  name: string;
  maxParticipants: number;
  createdAt: string;
}

