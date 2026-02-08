/**
 * Peer Connection Manager.
 * Wraps RTCPeerConnection and handles WebRTC complexity.
 *
 * Responsibilities:
 * - Create/manage RTCPeerConnection
 * - Add local tracks
 * - Handle remote tracks
 * - Create/handle offers and answers
 * - Handle ICE candidates
 * - Emit connection events
 *
 * Coding rules:
 * - No any
 * - Explicit types everywhere
 * - Clean error handling
 * - Memory-safe (cleanup on close)
 */

import { EventEmitter } from '../events';
import { SDKErrorCodes } from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Peer connection events.
 */
export interface PeerConnectionEvents {
  /** Remote track received */
  'track-added': { track: MediaStreamTrack; stream: MediaStream };
  /** Remote track removed */
  'track-removed': { track: MediaStreamTrack };
  /** ICE candidate generated (send to remote) */
  'ice-candidate': { candidate: RTCIceCandidateInit };
  /** Connection state changed */
  'connection-state': { state: RTCPeerConnectionState };
  /** ICE connection state changed */
  'ice-state': { state: RTCIceConnectionState };
  /** Negotiation needed */
  'negotiation-needed': undefined;
  /** Error occurred */
  'error': { code: string; message: string };
}

/**
 * Peer connection configuration.
 */
export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
  debug?: boolean;
}

// =============================================================================
// DEFAULT ICE SERVERS
// =============================================================================

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// =============================================================================
// PEER CONNECTION MANAGER
// =============================================================================

/**
 * WebRTC peer connection wrapper.
 * Simplifies WebRTC API and provides typed events.
 */
export class PeerConnection extends EventEmitter<PeerConnectionEvents> {
  private config: PeerConnectionConfig;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream = new MediaStream();
  private makingOffer = false;
  private ignoreOffer = false;
  private isPolite = false; // Set by CallSDK based on isInitiator

  constructor(config: PeerConnectionConfig) {
    super();
    this.config = config;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Initialize the peer connection.
   * @param polite Whether this peer is "polite" (handles collisions gracefully)
   */
  init(polite: boolean): void {
    if (this.pc) {
      this.log('Already initialized');
      return;
    }

    this.isPolite = polite;
    this.log('Initializing peer connection, polite:', polite);

    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    this.setupEventHandlers();
  }

  /**
   * Add a local media stream.
   */
  addStream(stream: MediaStream): void {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    this.localStream = stream;

    for (const track of stream.getTracks()) {
      this.log('Adding local track:', track.kind);
      this.pc.addTrack(track, stream);
    }
  }

  /**
   * Add a single track.
   */
  addTrack(track: MediaStreamTrack, stream: MediaStream): void {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    this.log('Adding track:', track.kind);
    this.pc.addTrack(track, stream);
  }

  /**
   * Remove a track.
   */
  removeTrack(track: MediaStreamTrack): void {
    if (!this.pc) return;

    const sender = this.pc.getSenders().find((s) => s.track === track);
    if (sender) {
      this.log('Removing track:', track.kind);
      this.pc.removeTrack(sender);
    }
  }

  /**
   * Create an SDP offer.
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    this.log('Creating offer');
    this.makingOffer = true;

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.log('Offer created and set as local description');
      return this.pc.localDescription!;
    } finally {
      this.makingOffer = false;
    }
  }

  /**
   * Create an SDP answer.
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    this.log('Creating answer');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.log('Answer created and set as local description');
    return this.pc.localDescription!;
  }

  /**
   * Handle an incoming SDP offer.
   * Returns true if offer was accepted, false if ignored (collision).
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<boolean> {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    // Perfect negotiation pattern - handle offer collision
    const offerCollision =
      this.makingOffer || this.pc.signalingState !== 'stable';

    this.ignoreOffer = !this.isPolite && offerCollision;

    if (this.ignoreOffer) {
      this.log('Ignoring offer due to collision (impolite peer)');
      return false;
    }

    this.log('Handling offer');
    await this.pc.setRemoteDescription(offer);
    return true;
  }

  /**
   * Handle an incoming SDP answer.
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    this.log('Handling answer');
    await this.pc.setRemoteDescription(answer);
  }

  /**
   * Add a remote ICE candidate.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }

    // Ignore if we're ignoring the current offer
    if (this.ignoreOffer) {
      this.log('Ignoring ICE candidate (ignoring offer)');
      return;
    }

    try {
      this.log('Adding ICE candidate');
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      // Ignore errors if we're not in a state to accept candidates
      if (!this.ignoreOffer) {
        throw error;
      }
    }
  }

  /**
   * Get the remote media stream.
   */
  getRemoteStream(): MediaStream {
    return this.remoteStream;
  }

  /**
   * Get connection state.
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.pc?.connectionState ?? null;
  }

  /**
   * Close the peer connection.
   */
  close(): void {
    this.log('Closing peer connection');
    this.cleanup();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private setupEventHandlers(): void {
    if (!this.pc) return;

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.log('ICE candidate generated');
        this.emit('ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote tracks
    this.pc.ontrack = (event) => {
      this.log('Remote track received:', event.track.kind);
      const track = event.track;

      // Add to our composite remote stream
      this.remoteStream.addTrack(track);

      // Use the stream from the event (associated with the sender)
      const stream = event.streams[0] ?? this.remoteStream;

      this.emit('track-added', { track, stream });

      // Handle track ending
      track.onended = () => {
        this.log('Remote track ended:', track.kind);
        this.remoteStream.removeTrack(track);
        this.emit('track-removed', { track });
      };
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state) {
        this.log('Connection state:', state);
        this.emit('connection-state', { state });

        if (state === 'failed') {
          this.emit('error', {
            code: SDKErrorCodes.ICE_FAILED,
            message: 'WebRTC connection failed',
          });
        }
      }
    };

    // Handle ICE connection state changes
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state) {
        this.log('ICE connection state:', state);
        this.emit('ice-state', { state });
      }
    };

    // Handle negotiation needed (for renegotiation)
    this.pc.onnegotiationneeded = () => {
      this.log('Negotiation needed');
      this.emit('negotiation-needed', undefined);
    };
  }

  private cleanup(): void {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onnegotiationneeded = null;
      this.pc.close();
      this.pc = null;
    }

    // Stop local tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    // Clear remote stream
    for (const track of this.remoteStream.getTracks()) {
      this.remoteStream.removeTrack(track);
    }

    this.removeAllListeners();
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[PeerConnection]', ...args);
    }
  }
}
