/**
 * WebSocket Signaling Server.
 * Handles real-time signaling for WebRTC connections.
 *
 * Responsibilities:
 * - Room presence
 * - SDP exchange
 * - ICE candidate forwarding
 * - Join / leave notifications
 *
 * Non-responsibilities:
 * - NO media flow
 * - NO database writes
 * - NO end-user authentication (JWT validated only)
 *
 * Coding rules:
 * - No any
 * - Explicit types everywhere
 * - Fail fast with clear errors
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { roomManager } from './room-manager';
import {
  type OutgoingMessage,
  type TokenClaims,
  type RTCSessionDescriptionInit,
  type RTCIceCandidateInit,
  SignalingErrorCodes,
  isValidIncomingMessage,
} from './types';

/**
 * Server configuration.
 */
export interface SignalingServerConfig {
  port: number;
  jwtSecret: string;
}

/**
 * Extended WebSocket with custom properties.
 */
interface ExtendedWebSocket extends WebSocket {
  socketId: string;
  isAlive: boolean;
}

/**
 * Creates and starts the signaling server.
 */
export function createSignalingServer(config: SignalingServerConfig): WebSocketServer {
  const wss = new WebSocketServer({ port: config.port });

  console.log(`[Signaling] WebSocket server starting on port ${config.port}`);

  // Heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as ExtendedWebSocket;

      if (!socket.isAlive) {
        console.log(`[Signaling] Terminating dead connection: ${socket.socketId}`);
        return socket.terminate();
      }

      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    const socket = ws as ExtendedWebSocket;
    socket.socketId = randomUUID();
    socket.isAlive = true;

    // Register peer in room manager
    roomManager.registerPeer(socket.socketId);

    console.log(`[Signaling] New connection: ${socket.socketId}`);

    // Handle pong (heartbeat response)
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    // Handle messages
    socket.on('message', (data: RawData) => {
      handleMessage(socket, data, config.jwtSecret, wss);
    });

    // Handle disconnect
    socket.on('close', () => {
      handleDisconnect(socket, wss);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[Signaling] Socket error for ${socket.socketId}:`, error.message);
    });
  });

  wss.on('listening', () => {
    console.log(`[Signaling] WebSocket server listening on port ${config.port}`);
  });

  wss.on('error', (error) => {
    console.error('[Signaling] Server error:', error);
  });

  return wss;
}

/**
 * Handles an incoming WebSocket message.
 */
function handleMessage(
  socket: ExtendedWebSocket,
  data: RawData,
  jwtSecret: string,
  wss: WebSocketServer
): void {
  let message: unknown;

  try {
    message = JSON.parse(data.toString());
  } catch {
    sendError(socket, SignalingErrorCodes.INVALID_MESSAGE, 'Invalid JSON');
    return;
  }

  if (!isValidIncomingMessage(message)) {
    sendError(socket, SignalingErrorCodes.INVALID_MESSAGE, 'Invalid message format');
    return;
  }

  switch (message.type) {
    case 'join':
      handleJoin(socket, message.roomId, message.token, jwtSecret, wss);
      break;

    case 'offer':
      handleOffer(socket, message.sdp, wss);
      break;

    case 'answer':
      handleAnswer(socket, message.sdp, wss);
      break;

    case 'ice':
      handleIce(socket, message.candidate, wss);
      break;

    case 'leave':
      handleLeave(socket, wss);
      break;
  }
}

/**
 * Handles a join request.
 */
function handleJoin(
  socket: ExtendedWebSocket,
  roomId: string,
  token: string,
  jwtSecret: string,
  wss: WebSocketServer
): void {
  // Verify JWT token
  let claims: TokenClaims;

  try {
    claims = jwt.verify(token, jwtSecret) as TokenClaims;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(socket, SignalingErrorCodes.TOKEN_EXPIRED, 'Token has expired');
    } else {
      sendError(socket, SignalingErrorCodes.INVALID_TOKEN, 'Invalid token');
    }
    return;
  }

  // Validate token claims match the requested room
  if (claims.roomId !== roomId) {
    sendError(socket, SignalingErrorCodes.INVALID_TOKEN, 'Token not valid for this room');
    return;
  }

  // Get existing peers before joining (to determine initiator)
  const existingPeers = roomManager.getRoomUserIds(roomId);

  // Join the room
  const result = roomManager.joinRoom(socket.socketId, roomId, claims.userId, claims.appId);

  if (!result.success) {
    sendError(socket, result.code, result.error);
    return;
  }

  console.log(`[Signaling] ${claims.userId} joined room ${roomId} (socket: ${socket.socketId})`);

  // Send joined confirmation to the new peer
  const joinedMessage: OutgoingMessage = {
    type: 'joined',
    roomId,
    userId: claims.userId,
    peers: existingPeers,
  };
  send(socket, joinedMessage);

  // Notify existing peers about the new peer
  // The new peer is NOT the initiator (existing peer creates offer)
  const peerSocketIds = roomManager.getRoomPeers(socket.socketId);

  for (const peerSocketId of peerSocketIds) {
    const peerSocket = findSocket(wss, peerSocketId);

    if (peerSocket) {
      const peerJoinedMessage: OutgoingMessage = {
        type: 'peer-joined',
        userId: claims.userId,
        isInitiator: true, // Existing peer should create the offer
      };
      send(peerSocket, peerJoinedMessage);
    }
  }
}

/**
 * Handles an SDP offer.
 */
function handleOffer(
  socket: ExtendedWebSocket,
  sdp: RTCSessionDescriptionInit,
  wss: WebSocketServer
): void {
  const peer = roomManager.getPeer(socket.socketId);

  if (!peer?.roomId || !peer.userId) {
    sendError(socket, SignalingErrorCodes.NOT_IN_ROOM, 'Must join a room first');
    return;
  }

  // Relay offer to other peers in the room
  const peerSocketIds = roomManager.getRoomPeers(socket.socketId);

  for (const peerSocketId of peerSocketIds) {
    const peerSocket = findSocket(wss, peerSocketId);

    if (peerSocket) {
      const relayedOffer: OutgoingMessage = {
        type: 'offer',
        sdp,
        fromUserId: peer.userId,
      };
      send(peerSocket, relayedOffer);
    }
  }

  console.log(`[Signaling] Relayed offer from ${peer.userId} in room ${peer.roomId}`);
}

/**
 * Handles an SDP answer.
 */
function handleAnswer(
  socket: ExtendedWebSocket,
  sdp: RTCSessionDescriptionInit,
  wss: WebSocketServer
): void {
  const peer = roomManager.getPeer(socket.socketId);

  if (!peer?.roomId || !peer.userId) {
    sendError(socket, SignalingErrorCodes.NOT_IN_ROOM, 'Must join a room first');
    return;
  }

  // Relay answer to other peers in the room
  const peerSocketIds = roomManager.getRoomPeers(socket.socketId);

  for (const peerSocketId of peerSocketIds) {
    const peerSocket = findSocket(wss, peerSocketId);

    if (peerSocket) {
      const relayedAnswer: OutgoingMessage = {
        type: 'answer',
        sdp,
        fromUserId: peer.userId,
      };
      send(peerSocket, relayedAnswer);
    }
  }

  console.log(`[Signaling] Relayed answer from ${peer.userId} in room ${peer.roomId}`);
}

/**
 * Handles an ICE candidate.
 */
function handleIce(
  socket: ExtendedWebSocket,
  candidate: RTCIceCandidateInit,
  wss: WebSocketServer
): void {
  const peer = roomManager.getPeer(socket.socketId);

  if (!peer?.roomId || !peer.userId) {
    sendError(socket, SignalingErrorCodes.NOT_IN_ROOM, 'Must join a room first');
    return;
  }

  // Relay ICE candidate to other peers in the room
  const peerSocketIds = roomManager.getRoomPeers(socket.socketId);

  for (const peerSocketId of peerSocketIds) {
    const peerSocket = findSocket(wss, peerSocketId);

    if (peerSocket) {
      const relayedIce: OutgoingMessage = {
        type: 'ice',
        candidate,
        fromUserId: peer.userId,
      };
      send(peerSocket, relayedIce);
    }
  }
}

/**
 * Handles an explicit leave request.
 */
function handleLeave(socket: ExtendedWebSocket, wss: WebSocketServer): void {
  const peer = roomManager.getPeer(socket.socketId);

  if (!peer?.roomId || !peer.userId) {
    return; // Not in a room, nothing to do
  }

  const userId = peer.userId;
  const result = roomManager.leaveRoom(socket.socketId);

  if (result) {
    console.log(`[Signaling] ${userId} left room ${result.roomId}`);

    // Notify remaining peers
    notifyPeerLeft(wss, result.remainingPeers, userId);
  }
}

/**
 * Handles a socket disconnect.
 */
function handleDisconnect(socket: ExtendedWebSocket, wss: WebSocketServer): void {
  const result = roomManager.removePeer(socket.socketId);

  if (result) {
    console.log(`[Signaling] ${result.userId} disconnected from room ${result.roomId}`);

    // Notify remaining peers
    notifyPeerLeft(wss, result.remainingPeers, result.userId);
  } else {
    console.log(`[Signaling] Connection closed: ${socket.socketId}`);
  }
}

/**
 * Notifies peers that someone left.
 */
function notifyPeerLeft(wss: WebSocketServer, peerSocketIds: string[], userId: string): void {
  for (const peerSocketId of peerSocketIds) {
    const peerSocket = findSocket(wss, peerSocketId);

    if (peerSocket) {
      const peerLeftMessage: OutgoingMessage = {
        type: 'peer-left',
        userId,
      };
      send(peerSocket, peerLeftMessage);
    }
  }
}

/**
 * Finds a socket by ID.
 */
function findSocket(wss: WebSocketServer, socketId: string): ExtendedWebSocket | undefined {
  for (const client of wss.clients) {
    const socket = client as ExtendedWebSocket;
    if (socket.socketId === socketId && socket.readyState === WebSocket.OPEN) {
      return socket;
    }
  }
  return undefined;
}

/**
 * Sends a message to a socket.
 */
function send(socket: ExtendedWebSocket, message: OutgoingMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/**
 * Sends an error message to a socket.
 */
function sendError(socket: ExtendedWebSocket, code: string, message: string): void {
  const errorMessage: OutgoingMessage = {
    type: 'error',
    code,
    message,
  };
  send(socket, errorMessage);
}

/**
 * Gets server statistics.
 */
export function getServerStats(): {
  totalPeers: number;
  totalRooms: number;
  peersInRooms: number;
} {
  return roomManager.getStats();
}
