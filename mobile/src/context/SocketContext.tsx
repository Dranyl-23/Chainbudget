/**
 * SocketContext.tsx
 *
 * Provides real-time WebSocket state and event dispatching across the app.
 * Automatically synchronizes with the user's login state.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  on: () => () => {},
  emit: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let cleanupFn: (() => void) | null = null;

    if (user) {
      getSocket().then((s) => {
        if (!isMounted || !s) return;
        setSocketInstance(s);
        setIsConnected(s.connected);

        const onConnect = () => { if (isMounted) setIsConnected(true); };
        const onDisconnect = () => { if (isMounted) setIsConnected(false); };

        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);

        cleanupFn = () => {
          s.off('connect', onConnect);
          s.off('disconnect', onDisconnect);
        };
      });
    } else {
      disconnectSocket();
      setSocketInstance(null);
      setIsConnected(false);
    }

    return () => {
      isMounted = false;
      cleanupFn?.();
    };
  }, [user]);

  /**
   * Helper to subscribe to socket events with automatic cleanup
   */
  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    let activeSocket: Socket | null = socketInstance;

    if (activeSocket) {
      activeSocket.on(event, callback);
    } else {
      getSocket().then((s) => {
        if (s) {
          activeSocket = s;
          s.on(event, callback);
        }
      });
    }

    return () => {
      if (activeSocket) {
        activeSocket.off(event, callback);
      } else {
        getSocket().then((s) => {
          s?.off(event, callback);
        });
      }
    };
  }, [socketInstance]);

  /**
   * Helper to emit socket events reliably
   */
  const emit = useCallback((event: string, ...args: any[]) => {
    if (socketInstance && socketInstance.connected) {
      socketInstance.emit(event, ...args);
    } else {
      getSocket().then((s) => {
        if (s && s.connected) {
          s.emit(event, ...args);
        }
      });
    }
  }, [socketInstance]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketInstance,
        isConnected,
        on,
        emit,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
