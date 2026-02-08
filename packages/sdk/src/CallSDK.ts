/**
 * CallSDK - Main public API.
 * This is what customers use.
 *
 * PUBLIC API (LOCKED):
 *
 *   CallSDK.init({ appId })
 *   CallSDK.join({ roomId, token })
 *   CallSDK.leave()
 *   CallSDK.on("user-joined", handler)
 *   CallSDK.on("user-left", handler)
 *   CallSDK.on("track-added", handler)
 *   CallSDK.on("error", handler)
 *
 * Coding rules:
 * - No any
 * - Framework-agnostic
 * - No UI
 * - Hide all complexity
 */

import { EventEmitter } from './events';
import { SignalingClient } from './signaling';
import { PeerConnection, DEFAULT_ICE_SERVERS } from './webrtc';
import {
  type SDKConfig,
  type JoinOptions,
  type SDKEvents,
  type SDKState,
  type ConnectionState,
  type IncomingSignalingMessage,
  SDKErrorCodes,
} from './types';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_SIGNALING_URL = 'ws://localhost:3001';

// =============================================================================
// CALL SDK CLASS
// =============================================================================

/**
 * RTC Platform SDK.
 * Enables real-time video/audio calls in your application.
 *
 * @example
 * ```typescript
 * // Initialize
 * CallSDK.init({ appId: 'your-app-id' });
 *
 * // Join a room
 * await CallSDK.join({
 *   roomId: 'room-123',
 *   token: 'jwt-token-from-backend',
 *   stream: localMediaStream,
 * });
 *
 * // Handle remote tracks
 * CallSDK.on('track-added', ({ stream }) => {
 *   videoElement.srcObject = stream;
 * });
 *
 * // Leave
 * CallSDK.leave();
 * ```
 */
class CallSDKClass extends EventEmitter<SDKEvents> {
  private config: SDKConfig | null = null;
  private signaling: SignalingClient | null = null;
  private peerConnection: PeerConnection | null = null;
  private state: SDKState = {
    connectionState: 'disconnected',
    roomId: null,
    userId: null,
    localStream: null,
    remoteStreams: new Map(),
  };

  // Remote user tracking
  private remoteUserId: string | null = null;
  private isInitiator = false;

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Initialize the SDK.
   * Must be called before join().
   */
  init(config: SDKConfig): void {
    if (this.config) {
      this.emitError(SDKErrorCodes.ALREADY_INITIALIZED, 'SDK already initialized', false);
      return;
    }

    if (!config.appId) {
      this.emitError(SDKErrorCodes.INVALID_CONFIG, 'appId is required', true);
      return;
    }

    this.config = {
      signalingUrl: DEFAULT_SIGNALING_URL,
      debug: false,
      iceServers: DEFAULT_ICE_SERVERS,
      ...config,
    };

    this.log('Initialized with config:', {
      appId: this.config.appId,
      signalingUrl: this.config.signalingUrl,
    });
  }

  /**
   * Join a room.
   * @param options Room ID, token, and optional local stream
   * @returns Promise that resolves when joined
   */
  async join(options: JoinOptions): Promise<void> {
    if (!this.config) {
      throw new Error('SDK not initialized. Call init() first.');
    }

    if (this.state.roomId) {
      throw new Error('Already in a room. Call leave() first.');
    }

    const { roomId, token, stream } = options;

    if (!roomId || !token) {
      throw new Error('roomId and token are required');
    }

    this.log('Joining room:', roomId);
    this.setConnectionState('connecting');

    // Store local stream
    if (stream) {
      this.state.localStream = stream;
    }

    // Create signaling client
    this.signaling = new SignalingClient({
      url: this.config.signalingUrl!,
      debug: this.config.debug,
    });

    // Set up signaling event handlers
    this.setupSignalingHandlers();

    // Connect to signaling server
    this.signaling.connect();

    // Wait for connection
    await this.waitForConnection();

    // Send join message
    this.signaling.send({
      type: 'join',
      roomId,
      token,
    });

    // Wait for join confirmation
    await this.waitForJoined();

    this.log('Successfully joined room:', roomId);
  }

  /**
   * Leave the current room.
   */
  leave(): void {
    this.log('Leaving room');

    // Send leave message
    if (this.signaling?.isConnected()) {
      this.signaling.send({ type: 'leave' });
    }

    this.cleanup();
    this.setConnectionState('disconnected');
  }

  /**
   * Get current state (read-only).
   */
  getState(): Readonly<SDKState> {
    return this.state;
  }

  /**
   * Get local media stream.
   */
  getLocalStream(): MediaStream | null {
    return this.state.localStream;
  }

  /**
   * Add a local track to share.
   */
  addTrack(track: MediaStreamTrack): void {
    if (!this.peerConnection) {
      throw new Error('Not in a room');
    }

    if (!this.state.localStream) {
      this.state.localStream = new MediaStream();
    }

    this.state.localStream.addTrack(track);
    this.peerConnection.addTrack(track, this.state.localStream);
  }

  /**
   * Remove a local track.
   */
  removeTrack(track: MediaStreamTrack): void {
    if (!this.peerConnection) return;

    this.state.localStream?.removeTrack(track);
    this.peerConnection.removeTrack(track);
  }

  /**
   * Check if SDK is initialized.
   */
  isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Check if in a room.
   */
  isInRoom(): boolean {
    return this.state.roomId !== null;
  }

  // ===========================================================================
  // SIGNALING HANDLERS
  // ===========================================================================

  private setupSignalingHandlers(): void {
    if (!this.signaling) return;

    this.signaling.on('connected', () => {
      this.log('Signaling connected');
    });

    this.signaling.on('disconnected', ({ reason }) => {
      this.log('Signaling disconnected:', reason);
      if (reason !== 'intentional') {
        this.setConnectionState('reconnecting');
      }
    });

    this.signaling.on('reconnecting', ({ attempt }) => {
      this.log('Reconnecting, attempt:', attempt);
      this.setConnectionState('reconnecting');
    });

    this.signaling.on('message', (message) => {
      this.handleSignalingMessage(message);
    });

    this.signaling.on('error', ({ code, message, fatal }) => {
      this.emitError(code, message, fatal);
    });
  }

  private handleSignalingMessage(message: IncomingSignalingMessage): void {
    switch (message.type) {
      case 'joined':
        this.handleJoined(message);
        break;
      case 'peer-joined':
        this.handlePeerJoined(message);
        break;
      case 'peer-left':
        this.handlePeerLeft(message);
        break;
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'ice':
        this.handleIce(message);
        break;
      case 'error':
        this.handleSignalingError(message);
        break;
    }
  }

  private handleJoined(message: { roomId: string; userId: string; peers: string[] }): void {
    this.log('Joined room:', message.roomId, 'as', message.userId);
    this.state.roomId = message.roomId;
    this.state.userId = message.userId;
    this.setConnectionState('connected');

    // If there's already a peer in the room, we'll wait for peer-joined with isInitiator
    if (message.peers.length > 0) {
      this.log('Existing peers in room:', message.peers);
      // The server will send peer-joined for each existing peer
    }
  }

  private handlePeerJoined(message: { userId: string; isInitiator: boolean }): void {
    this.log('Peer joined:', message.userId, 'isInitiator:', message.isInitiator);
    this.remoteUserId = message.userId;
    this.isInitiator = message.isInitiator;

    // Emit user-joined event
    this.emit('user-joined', { userId: message.userId });

    // Create peer connection
    this.createPeerConnection();

    // If we're the initiator, create an offer
    if (message.isInitiator) {
      this.log('I am initiator, creating offer');
      this.createAndSendOffer();
    }
  }

  private handlePeerLeft(message: { userId: string }): void {
    this.log('Peer left:', message.userId);

    // Emit user-left event
    this.emit('user-left', { userId: message.userId });

    // Clean up peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteUserId = null;
    this.state.remoteStreams.delete(message.userId);
  }

  private async handleOffer(message: { sdp: RTCSessionDescriptionInit; fromUserId: string }): Promise<void> {
    this.log('Received offer from:', message.fromUserId);

    if (!this.peerConnection) {
      // Peer connection might not exist if we joined after the other peer
      this.remoteUserId = message.fromUserId;
      this.createPeerConnection();
    }

    try {
      const accepted = await this.peerConnection!.handleOffer(message.sdp);
      if (accepted) {
        const answer = await this.peerConnection!.createAnswer();
        this.signaling?.send({ type: 'answer', sdp: answer });
      }
    } catch (error) {
      this.log('Error handling offer:', error);
      this.emitError(SDKErrorCodes.NEGOTIATION_FAILED, 'Failed to handle offer', false);
    }
  }

  private async handleAnswer(message: { sdp: RTCSessionDescriptionInit; fromUserId: string }): Promise<void> {
    this.log('Received answer from:', message.fromUserId);

    if (!this.peerConnection) {
      this.log('No peer connection for answer');
      return;
    }

    try {
      await this.peerConnection.handleAnswer(message.sdp);
    } catch (error) {
      this.log('Error handling answer:', error);
      this.emitError(SDKErrorCodes.NEGOTIATION_FAILED, 'Failed to handle answer', false);
    }
  }

  private async handleIce(message: { candidate: RTCIceCandidateInit; fromUserId: string }): Promise<void> {
    this.log('Received ICE candidate from:', message.fromUserId);

    if (!this.peerConnection) {
      this.log('No peer connection for ICE candidate');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(message.candidate);
    } catch (error) {
      this.log('Error adding ICE candidate:', error);
    }
  }

  private handleSignalingError(message: { code: string; message: string }): void {
    this.log('Signaling error:', message.code, message.message);

    const fatal = message.code === 'ROOM_FULL' || message.code === 'INVALID_TOKEN';
    this.emitError(message.code, message.message, fatal);

    if (fatal) {
      this.cleanup();
      this.setConnectionState('failed');
    }
  }

  // ===========================================================================
  // PEER CONNECTION MANAGEMENT
  // ===========================================================================

  private createPeerConnection(): void {
    if (this.peerConnection) {
      return;
    }

    this.log('Creating peer connection');

    this.peerConnection = new PeerConnection({
      iceServers: this.config!.iceServers!,
      debug: this.config!.debug,
    });

    // "Polite" peer is the one who doesn't initiate (handles collisions gracefully)
    this.peerConnection.init(!this.isInitiator);

    // Add local stream if we have one
    if (this.state.localStream) {
      this.peerConnection.addStream(this.state.localStream);
    }

    // Set up peer connection event handlers
    this.setupPeerConnectionHandlers();
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Handle ICE candidates
    this.peerConnection.on('ice-candidate', ({ candidate }) => {
      this.signaling?.send({ type: 'ice', candidate });
    });

    // Handle remote tracks
    this.peerConnection.on('track-added', ({ track, stream }) => {
      this.log('Remote track added:', track.kind);

      // Store in state
      if (this.remoteUserId) {
        this.state.remoteStreams.set(this.remoteUserId, stream);
      }

      // Emit to user
      this.emit('track-added', {
        userId: this.remoteUserId!,
        track,
        stream,
      });
    });

    // Handle track removal
    this.peerConnection.on('track-removed', ({ track }) => {
      this.log('Remote track removed:', track.kind);
      this.emit('track-removed', {
        userId: this.remoteUserId!,
        track,
      });
    });

    // Handle connection state changes
    this.peerConnection.on('connection-state', ({ state }) => {
      this.log('Peer connection state:', state);

      if (state === 'connected') {
        this.setConnectionState('connected');
      } else if (state === 'failed' || state === 'disconnected') {
        // Don't immediately fail - could be temporary
        if (state === 'failed') {
          this.emitError(SDKErrorCodes.ICE_FAILED, 'WebRTC connection failed', false);
        }
      }
    });

    // Handle negotiation needed (for renegotiation, e.g., adding tracks)
    this.peerConnection.on('negotiation-needed', () => {
      if (this.isInitiator) {
        this.createAndSendOffer();
      }
    });

    // Handle errors
    this.peerConnection.on('error', ({ code, message }) => {
      this.emitError(code, message, false);
    });
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection || !this.signaling) return;

    try {
      const offer = await this.peerConnection.createOffer();
      this.signaling.send({ type: 'offer', sdp: offer });
    } catch (error) {
      this.log('Error creating offer:', error);
      this.emitError(SDKErrorCodes.NEGOTIATION_FAILED, 'Failed to create offer', false);
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.signaling) {
        reject(new Error('No signaling client'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const unsubscribe = this.signaling.on('connected', () => {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });

      const unsubscribeError = this.signaling.on('error', ({ message, fatal }) => {
        if (fatal) {
          clearTimeout(timeout);
          unsubscribe();
          unsubscribeError();
          reject(new Error(message));
        }
      });
    });
  }

  private waitForJoined(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.signaling) {
        reject(new Error('No signaling client'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Join timeout'));
      }, 10000);

      const unsubscribe = this.signaling.on('message', (message) => {
        if (message.type === 'joined') {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        } else if (message.type === 'error') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error(message.message));
        }
      });
    });
  }

  private setConnectionState(state: ConnectionState): void {
    const previousState = this.state.connectionState;
    if (previousState === state) return;

    this.state.connectionState = state;
    this.emit('connection-state', { state, previousState });
  }

  private emitError(code: string, message: string, fatal: boolean): void {
    this.log('Error:', code, message, 'fatal:', fatal);
    this.emit('error', { code, message, fatal });
  }

  private cleanup(): void {
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Disconnect signaling
    if (this.signaling) {
      this.signaling.disconnect();
      this.signaling.removeAllListeners();
      this.signaling = null;
    }

    // Reset state
    this.state.roomId = null;
    this.state.userId = null;
    this.state.localStream = null;
    this.state.remoteStreams.clear();
    this.remoteUserId = null;
    this.isInitiator = false;
  }

  private log(...args: unknown[]): void {
    if (this.config?.debug) {
      console.log('[CallSDK]', ...args);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * The SDK instance.
 * Use this directly - no need to instantiate.
 */
export const CallSDK = new CallSDKClass();
