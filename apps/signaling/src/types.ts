/**
 * Signaling server types.
 * Defines the message protocol for WebRTC signaling.
 *
 * IMPORTANT: This protocol is consumed by:
 * - Client SDK
 * - Demo app
 * DO NOT change casually.
 *
 * Coding rules:
 * - No any
 * - Explicit types everywhere
 * - Protocol is locked after SDK release
 */

// =============================================================================
// WEBRTC TYPES (Node.js doesn't have these, so we define them)
// =============================================================================

/**
 * SDP session description for WebRTC negotiation.
 * Matches the browser's RTCSessionDescriptionInit interface.
 */
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

/**
 * ICE candidate for NAT traversal.
 * Matches the browser's RTCIceCandidateInit interface.
 */
export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

// =============================================================================
// INCOMING MESSAGES (Client → Server)
// =============================================================================

/**
 * Client wants to join a room.
 * First message after WebSocket connection.
 */
export interface JoinMessage {
  type: 'join';
  roomId: string;
  token: string; // JWT token from API
}

/**
 * WebRTC SDP offer from caller.
 */
export interface OfferMessage {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
}

/**
 * WebRTC SDP answer from callee.
 */
export interface AnswerMessage {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
}

/**
 * ICE candidate for NAT traversal.
 */
export interface IceCandidateMessage {
  type: 'ice';
  candidate: RTCIceCandidateInit;
}

/**
 * Client explicitly leaving the room.
 */
export interface LeaveMessage {
  type: 'leave';
}

/**
 * Union of all incoming message types.
 */
export type IncomingMessage =
  | JoinMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | LeaveMessage;

// =============================================================================
// OUTGOING MESSAGES (Server → Client)
// =============================================================================

/**
 * Sent to existing peer when someone joins.
 */
export interface PeerJoinedMessage {
  type: 'peer-joined';
  userId: string;
  isInitiator: boolean; // Should this peer create the offer?
}

/**
 * Sent to remaining peer when someone leaves.
 */
export interface PeerLeftMessage {
  type: 'peer-left';
  userId: string;
}

/**
 * Relayed SDP offer.
 */
export interface RelayedOfferMessage {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
  fromUserId: string;
}

/**
 * Relayed SDP answer.
 */
export interface RelayedAnswerMessage {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
  fromUserId: string;
}

/**
 * Relayed ICE candidate.
 */
export interface RelayedIceMessage {
  type: 'ice';
  candidate: RTCIceCandidateInit;
  fromUserId: string;
}

/**
 * Join was successful.
 */
export interface JoinedMessage {
  type: 'joined';
  roomId: string;
  userId: string;
  peers: string[]; // userIds of existing peers in room
}

/**
 * Error message.
 */
export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

/**
 * Union of all outgoing message types.
 */
export type OutgoingMessage =
  | PeerJoinedMessage
  | PeerLeftMessage
  | RelayedOfferMessage
  | RelayedAnswerMessage
  | RelayedIceMessage
  | JoinedMessage
  | ErrorMessage;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Represents a connected peer.
 */
export interface Peer {
  /** Unique socket identifier */
  socketId: string;
  /** Room the peer is in (null if not joined) */
  roomId: string | null;
  /** User identifier from JWT */
  userId: string | null;
  /** App (tenant) identifier from JWT */
  appId: string | null;
}

/**
 * Represents a room.
 */
export interface Room {
  /** Room identifier */
  id: string;
  /** App (tenant) that owns this room */
  appId: string;
  /** Set of socket IDs in this room */
  peers: Set<string>;
  /** Maximum participants allowed */
  maxParticipants: number;
}

/**
 * JWT token claims (must match API token claims).
 */
export interface TokenClaims {
  jti: string;
  appId: string;
  roomId: string;
  userId: string;
  role: 'host' | 'participant' | 'viewer';
  iat: number;
  exp: number;
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const SignalingErrorCodes = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ROOM_FULL: 'ROOM_FULL',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SignalingErrorCode = (typeof SignalingErrorCodes)[keyof typeof SignalingErrorCodes];

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a message is a valid incoming message.
 */
export function isValidIncomingMessage(data: unknown): data is IncomingMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const msg = data as Record<string, unknown>;

  if (typeof msg.type !== 'string') {
    return false;
  }

  switch (msg.type) {
    case 'join':
      return typeof msg.roomId === 'string' && typeof msg.token === 'string';
    case 'offer':
    case 'answer':
      return typeof msg.sdp === 'object' && msg.sdp !== null;
    case 'ice':
      return typeof msg.candidate === 'object' && msg.candidate !== null;
    case 'leave':
      return true;
    default:
      return false;
  }
}
