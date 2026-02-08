/**
 * Signaling Server Entry Point.
 * Starts the WebSocket signaling server.
 */

import { createSignalingServer, getServerStats } from './server';

// Configuration from environment
const config = {
  port: parseInt(process.env.SIGNALING_PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'rtc-platform-dev-secret-change-in-production',
};

// Validate config
if (config.jwtSecret === 'rtc-platform-dev-secret-change-in-production') {
  console.warn('[Signaling] WARNING: Using default JWT secret. Set JWT_SECRET in production!');
}

// Start the server
const wss = createSignalingServer(config);

// Log stats periodically
setInterval(() => {
  const stats = getServerStats();
  console.log(
    `[Signaling] Stats: ${stats.totalPeers} peers, ${stats.totalRooms} rooms, ${stats.peersInRooms} in rooms`
  );
}, 60000);

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n[Signaling] Received ${signal}, shutting down...`);

  wss.close(() => {
    console.log('[Signaling] Server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('[Signaling] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Export for testing
export { wss, config };
