/**
 * Room Manager.
 * In-memory room and peer tracking for signaling server.
 *
 * Rules:
 * - One WebSocket connection = one peer
 * - Rooms are in-memory (Map)
 * - Max participants per room = 2 (MVP)
 * - If third peer joins → reject
 *
 * Coding rules:
 * - No any
 * - Explicit types everywhere
 * - Fail fast with clear errors
 */

import type { Peer, Room } from './types';

const DEFAULT_MAX_PARTICIPANTS = 2;

/**
 * Manages rooms and peer connections.
 * All state is in-memory - no persistence.
 */
export class RoomManager {
  /** Map of roomId → Room */
  private rooms: Map<string, Room> = new Map();

  /** Map of socketId → Peer */
  private peers: Map<string, Peer> = new Map();

  /**
   * Registers a new peer connection.
   * Called when a WebSocket connection is established.
   */
  registerPeer(socketId: string): Peer {
    const peer: Peer = {
      socketId,
      roomId: null,
      userId: null,
      appId: null,
    };

    this.peers.set(socketId, peer);
    return peer;
  }

  /**
   * Gets a peer by socket ID.
   */
  getPeer(socketId: string): Peer | undefined {
    return this.peers.get(socketId);
  }

  /**
   * Joins a peer to a room.
   * Returns error string if join fails, undefined if successful.
   */
  joinRoom(
    socketId: string,
    roomId: string,
    userId: string,
    appId: string
  ): { success: true } | { success: false; error: string; code: string } {
    const peer = this.peers.get(socketId);

    if (!peer) {
      return { success: false, error: 'Peer not found', code: 'INTERNAL_ERROR' };
    }

    // Check if already in a room
    if (peer.roomId !== null) {
      return { success: false, error: 'Already in a room', code: 'ALREADY_IN_ROOM' };
    }

    // Get or create room
    let room = this.rooms.get(roomId);

    if (!room) {
      room = {
        id: roomId,
        appId,
        peers: new Set(),
        maxParticipants: DEFAULT_MAX_PARTICIPANTS,
      };
      this.rooms.set(roomId, room);
    }

    // Validate app ownership (all peers in room must be from same app)
    if (room.peers.size > 0 && room.appId !== appId) {
      return { success: false, error: 'Room belongs to different app', code: 'INVALID_TOKEN' };
    }

    // Check room capacity
    if (room.peers.size >= room.maxParticipants) {
      return { success: false, error: 'Room is full', code: 'ROOM_FULL' };
    }

    // Join the room
    room.peers.add(socketId);
    peer.roomId = roomId;
    peer.userId = userId;
    peer.appId = appId;

    return { success: true };
  }

  /**
   * Removes a peer from their current room.
   * Called on disconnect or explicit leave.
   * Returns the room and remaining peers if peer was in a room.
   */
  leaveRoom(socketId: string): { roomId: string; remainingPeers: string[] } | null {
    const peer = this.peers.get(socketId);

    if (!peer || !peer.roomId) {
      return null;
    }

    const roomId = peer.roomId;
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    // Remove peer from room
    room.peers.delete(socketId);

    // Get remaining peer socket IDs
    const remainingPeers = Array.from(room.peers);

    // Clean up empty room
    if (room.peers.size === 0) {
      this.rooms.delete(roomId);
    }

    // Update peer state
    peer.roomId = null;
    peer.userId = null;
    peer.appId = null;

    return { roomId, remainingPeers };
  }

  /**
   * Removes a peer completely (disconnect).
   * Handles leaving room and cleaning up.
   */
  removePeer(socketId: string): { roomId: string; remainingPeers: string[]; userId: string } | null {
    const peer = this.peers.get(socketId);

    if (!peer) {
      return null;
    }

    const userId = peer.userId;
    const leaveResult = this.leaveRoom(socketId);

    // Remove from peers map
    this.peers.delete(socketId);

    if (leaveResult && userId) {
      return {
        roomId: leaveResult.roomId,
        remainingPeers: leaveResult.remainingPeers,
        userId,
      };
    }

    return null;
  }

  /**
   * Gets all other peer socket IDs in the same room.
   */
  getRoomPeers(socketId: string): string[] {
    const peer = this.peers.get(socketId);

    if (!peer || !peer.roomId) {
      return [];
    }

    const room = this.rooms.get(peer.roomId);

    if (!room) {
      return [];
    }

    return Array.from(room.peers).filter((id) => id !== socketId);
  }

  /**
   * Gets user IDs of all peers in a room.
   */
  getRoomUserIds(roomId: string): string[] {
    const room = this.rooms.get(roomId);

    if (!room) {
      return [];
    }

    const userIds: string[] = [];

    for (const socketId of room.peers) {
      const peer = this.peers.get(socketId);
      if (peer?.userId) {
        userIds.push(peer.userId);
      }
    }

    return userIds;
  }

  /**
   * Gets the userId for a given socketId.
   */
  getUserId(socketId: string): string | null {
    const peer = this.peers.get(socketId);
    return peer?.userId ?? null;
  }

  /**
   * Gets room info.
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Gets statistics for monitoring.
   */
  getStats(): { totalPeers: number; totalRooms: number; peersInRooms: number } {
    let peersInRooms = 0;

    for (const room of this.rooms.values()) {
      peersInRooms += room.peers.size;
    }

    return {
      totalPeers: this.peers.size,
      totalRooms: this.rooms.size,
      peersInRooms,
    };
  }
}

/**
 * Singleton instance of RoomManager.
 */
export const roomManager = new RoomManager();
