/**
 * Signaling Client.
 * Manages WebSocket connection to the signaling server.
 *
 * Responsibilities:
 * - Connect / disconnect
 * - Send messages
 * - Receive messages
 * - Reconnection with exponential backoff
 * - Emit typed events
 *
 * Coding rules:
 * - No any
 * - Explicit types everywhere
 * - Clean error handling
 * - Memory-safe (cleanup on disconnect)
 */

import { EventEmitter } from '../events';
import {
  type OutgoingSignalingMessage,
  type IncomingSignalingMessage,
  SDKErrorCodes,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Signaling client events.
 */
export interface SignalingEvents {
  /** Connection established */
  connected: undefined;
  /** Connection closed */
  disconnected: { reason: string };
  /** Attempting to reconnect */
  reconnecting: { attempt: number };
  /** Message received from server */
  message: IncomingSignalingMessage;
  /** Error occurred */
  error: { code: string; message: string; fatal: boolean };
}

/**
 * Signaling client configuration.
 */
export interface SignalingConfig {
  url: string;
  debug?: boolean;
}

/**
 * Connection state.
 */
type SignalingState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// =============================================================================
// CONSTANTS
// =============================================================================

const RECONNECT_BASE_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 30000; // 30 seconds
const RECONNECT_MAX_ATTEMPTS = 5;

// =============================================================================
// SIGNALING CLIENT
// =============================================================================

/**
 * WebSocket signaling client.
 * Handles connection to signaling server with automatic reconnection.
 */
export class SignalingClient extends EventEmitter<SignalingEvents> {
  private config: SignalingConfig;
  private socket: WebSocket | null = null;
  private state: SignalingState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: OutgoingSignalingMessage[] = [];
  private intentionalClose = false;

  constructor(config: SignalingConfig) {
    super();
    this.config = config;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Get current connection state.
   */
  getState(): SignalingState {
    return this.state;
  }

  /**
   * Connect to the signaling server.
   */
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      this.log('Already connected or connecting');
      return;
    }

    this.intentionalClose = false;
    this.setState('connecting');
    this.createSocket();
  }

  /**
   * Disconnect from the signaling server.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
    this.setState('disconnected');
    this.emit('disconnected', { reason: 'intentional' });
  }

  /**
   * Send a message to the signaling server.
   * If not connected, queues the message for later.
   */
  send(message: OutgoingSignalingMessage): void {
    if (this.state !== 'connected' || !this.socket) {
      this.log('Not connected, queueing message:', message.type);
      this.pendingMessages.push(message);
      return;
    }

    try {
      const data = JSON.stringify(message);
      this.socket.send(data);
      this.log('Sent:', message.type);
    } catch (error) {
      this.log('Send error:', error);
      this.pendingMessages.push(message);
    }
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private createSocket(): void {
    try {
      this.log('Creating WebSocket connection to:', this.config.url);
      this.socket = new WebSocket(this.config.url);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      this.log('Failed to create WebSocket:', error);
      this.emit('error', {
        code: SDKErrorCodes.CONNECTION_FAILED,
        message: 'Failed to create WebSocket connection',
        fatal: true,
      });
    }
  }

  private handleOpen(): void {
    this.log('Connected');
    this.setState('connected');
    this.reconnectAttempts = 0;
    this.emit('connected', undefined);
    this.flushPendingMessages();
  }

  private handleClose(event: CloseEvent): void {
    this.log('Connection closed:', event.code, event.reason);
    this.socket = null;

    if (this.intentionalClose) {
      return;
    }

    // Attempt reconnection
    if (this.reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
      this.emit('error', {
        code: SDKErrorCodes.RECONNECT_FAILED,
        message: `Failed to reconnect after ${RECONNECT_MAX_ATTEMPTS} attempts`,
        fatal: true,
      });
      this.emit('disconnected', { reason: 'reconnect_failed' });
    }
  }

  private handleError(event: Event): void {
    this.log('WebSocket error:', event);
    // Don't emit error here - onclose will be called next
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string) as IncomingSignalingMessage;
      this.log('Received:', message.type);
      this.emit('message', message);
    } catch (error) {
      this.log('Failed to parse message:', error);
      this.emit('error', {
        code: SDKErrorCodes.CONNECTION_FAILED,
        message: 'Failed to parse server message',
        fatal: false,
      });
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY
    );

    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.setState('reconnecting');
    this.emit('reconnecting', { attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createSocket();
    }, delay);
  }

  private flushPendingMessages(): void {
    const messages = this.pendingMessages.splice(0);
    for (const message of messages) {
      this.send(message);
    }
  }

  private setState(state: SignalingState): void {
    this.log('State:', this.state, '->', state);
    this.state = state;
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.close();
      this.socket = null;
    }

    this.pendingMessages = [];
    this.reconnectAttempts = 0;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[SignalingClient]', ...args);
    }
  }
}
