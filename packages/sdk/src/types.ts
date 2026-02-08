/**
 * SDK Types.
 * Defines the public API contract.
 *
 * IMPORTANT: This is the PUBLIC SDK interface.
 * Changes here affect all customers.
 *
 * Coding rules:
 * - No any
 * - Explicit types everywhere
 * - Framework-agnostic
 * - No DOM assumptions except WebRTC APIs
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * SDK initialization options.
 */
export interface SDKConfig {
  /**
   * Your app ID from the RTC Platform dashboard.
   */
  appId: string;

  /**
   * Signaling server URL.
   * @default 'wss://signaling.rtc-platform.com'
   */
  signalingUrl?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;

  /**
   * ICE servers for WebRTC.
   * @default Google STUN servers
   */
  iceServers?: RTCIceServer[];
}

/**
 * Options for joining a room.
 */
export interface JoinOptions {
  /**
   * Room ID to join.
   */
  roomId: string;

  /**
   * JWT token from your backend.
   */
  token: string;

  /**
   * Local media stream to share.
   * If not provided, you must call addTrack() later.
   */
  stream?: MediaStream;
}

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Emitted when a remote user joins the room.
 */
export interface UserJoinedEvent {
  userId: string;
}

/**
 * Emitted when a remote user leaves the room.
 */
export interface UserLeftEvent {
  userId: string;
}

/**
 * Emitted when a remote track is received.
 * This is what you render in your UI.
 */
export interface TrackAddedEvent {
  userId: string;
  track: MediaStreamTrack;
  stream: MediaStream;
}

/**
 * Emitted when a remote track is removed.
 */
export interface TrackRemovedEvent {
  userId: string;
  track: MediaStreamTrack;
}

/**
 * Emitted when the connection state changes.
 */
export interface ConnectionStateEvent {
  state: ConnectionState;
  previousState: ConnectionState;
}

/**
 * Emitted on errors.
 */
export interface ErrorEvent {
  code: string;
  message: string;
  fatal: boolean;
}

/**
 * All SDK events.
 */
export interface SDKEvents {
  'user-joined': UserJoinedEvent;
  'user-left': UserLeftEvent;
  'track-added': TrackAddedEvent;
  'track-removed': TrackRemovedEvent;
  'connection-state': ConnectionStateEvent;
  'error': ErrorEvent;
}

/**
 * Event handler type.
 */
export type EventHandler<T> = (event: T) => void;

// =============================================================================
// STATE
// =============================================================================

/**
 * SDK connection states.
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * Current SDK state (read-only).
 */
export interface SDKState {
  connectionState: ConnectionState;
  roomId: string | null;
  userId: string | null;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}

// =============================================================================
// SIGNALING MESSAGES (Internal, matches server protocol)
// =============================================================================

/**
 * Message types sent TO signaling server.
 */
export type OutgoingSignalingMessage =
  | { type: 'join'; roomId: string; token: string }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'leave' };

/**
 * Message types received FROM signaling server.
 */
export type IncomingSignalingMessage =
  | { type: 'joined'; roomId: string; userId: string; peers: string[] }
  | { type: 'peer-joined'; userId: string; isInitiator: boolean }
  | { type: 'peer-left'; userId: string }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit; fromUserId: string }
  | { type: 'error'; code: string; message: string };

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * SDK error codes.
 */
export const SDKErrorCodes = {
  // Configuration errors
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  ALREADY_INITIALIZED: 'ALREADY_INITIALIZED',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_LOST: 'CONNECTION_LOST',
  RECONNECT_FAILED: 'RECONNECT_FAILED',

  // Room errors
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',
  ROOM_FULL: 'ROOM_FULL',

  // Auth errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // WebRTC errors
  WEBRTC_NOT_SUPPORTED: 'WEBRTC_NOT_SUPPORTED',
  ICE_FAILED: 'ICE_FAILED',
  NEGOTIATION_FAILED: 'NEGOTIATION_FAILED',

  // Media errors
  MEDIA_NOT_ALLOWED: 'MEDIA_NOT_ALLOWED',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
} as const;

export type SDKErrorCode = (typeof SDKErrorCodes)[keyof typeof SDKErrorCodes];
