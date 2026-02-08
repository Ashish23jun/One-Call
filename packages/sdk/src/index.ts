/**
 * RTC Platform SDK
 *
 * Add real-time video/audio calls to your application.
 *
 * @example
 * ```typescript
 * import { CallSDK } from '@rtc-platform/sdk';
 *
 * // Initialize
 * CallSDK.init({ appId: 'your-app-id' });
 *
 * // Get user media
 * const stream = await navigator.mediaDevices.getUserMedia({
 *   video: true,
 *   audio: true,
 * });
 *
 * // Join a room
 * await CallSDK.join({
 *   roomId: 'room-123',
 *   token: 'jwt-token-from-your-backend',
 *   stream,
 * });
 *
 * // Handle remote user joining
 * CallSDK.on('user-joined', ({ userId }) => {
 *   console.log('User joined:', userId);
 * });
 *
 * // Handle remote tracks
 * CallSDK.on('track-added', ({ userId, stream }) => {
 *   const video = document.getElementById('remote-video');
 *   video.srcObject = stream;
 * });
 *
 * // Handle errors
 * CallSDK.on('error', ({ code, message }) => {
 *   console.error('Error:', code, message);
 * });
 *
 * // Leave when done
 * CallSDK.leave();
 * ```
 *
 * @packageDocumentation
 */

// Main SDK export
export { CallSDK } from './CallSDK';

// Types for consumers
export type {
  SDKConfig,
  JoinOptions,
  SDKEvents,
  SDKState,
  ConnectionState,
  UserJoinedEvent,
  UserLeftEvent,
  TrackAddedEvent,
  TrackRemovedEvent,
  ConnectionStateEvent,
  ErrorEvent,
} from './types';

// Error codes for error handling
export { SDKErrorCodes } from './types';
export type { SDKErrorCode } from './types';
