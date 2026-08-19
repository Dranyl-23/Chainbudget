/**
 * SocketContext.tsx
 *
 * Provides real-time WebSocket state and event dispatching across the app.
 * Automatically synchronizes with the user's login state.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  on: () => () => {},
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

    if (user) {
      getSocket().then((s) => {
        if (!isMounted || !s) return;
        setSocketInstance(s);
        setIsConnected(s.connected);

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);

        return () => {
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
    };
  }, [user]);

  /**
   * Helper to subscribe to socket events with automatic cleanup
   */
  const on = (event: string, callback: (...args: any[]) => void) => {
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
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketInstance,
        isConnected,
        on,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
