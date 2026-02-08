/**
 * Room module exports.
 */

export { roomRoutes } from './room.routes';
export {
  createRoom,
  getRoomById,
  listRoomsByAppId,
  roomExistsForApp,
  getRoomInternal,
  deleteRoom,
} from './room.service';
export type { Room, CreateRoomInput, CreateRoomResponse, GetRoomResponse } from './room.types';
