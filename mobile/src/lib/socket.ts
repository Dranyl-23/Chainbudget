/**
 * socket.ts
 *
 * Client WebSocket manager for ChainBudget Mobile using socket.io-client.
 * Uses the standalone pre-bundled distribution to ensure 100% compatibility
 * with Metro bundler on Android and iOS.
 */

import type { Socket } from 'socket.io-client';
import { API_URL } from './api';
import { getSessionToken } from './secureStorage';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const io: (...args: any[]) => Socket = require('socket.io-client/dist/socket.io.js');

// Strip the /api prefix to get the root WebSocket server URL
export const SOCKET_URL = API_URL.replace(/\/api$/, '');

let socket: Socket | null = null;

/**
 * Initialize or get the active authenticated Socket.IO connection.
 */
export async function getSocket(): Promise<Socket | null> {
  const token = await getSessionToken();
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Mobile connected to server:', socket?.id);
  });

  socket.on('connect_error', (err: any) => {
    console.warn('[Socket.IO] Connection error:', err?.message || err);
  });

  socket.on('disconnect', (reason: any) => {
    console.log('[Socket.IO] Disconnected:', reason);
  });

  return socket;
}

/**
 * Explicitly disconnect and tear down socket instance (e.g. on logout)
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
