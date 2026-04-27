import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '@/lib/config';

interface UseSocketOptions {
  token?: string;
  enabled?: boolean;
  workspaceId?: string;
}

export function useSocket({ token, enabled = true, workspaceId }: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log('[Socket.IO] Socket disabled');
      return;
    }

    // We support cookie-based auth now; proceed even if token is not readable in JS
    if (!token) {
      console.log('[Socket.IO] No token provided, proceeding with cookie-based auth');
    }

    console.log('[Socket.IO] Initializing connection to:', APP_CONFIG.apiUrl);
    console.log('[Socket.IO] Token present:', !!token);

    // Initialize socket connection
    const socket = io(APP_CONFIG.apiUrl, {
      auth: { ...(token ? { token } : {}), ...(workspaceId ? { workspaceId } : {}) },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;
    setSocketState(socket);

    socket.on('connect', () => {
      console.log('[Socket.IO] ✅ Connected successfully!', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] ❌ Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] ❌ Connection error:', err.message);
      console.error('[Socket.IO] Error details:', err);
      setError(err.message);
      setIsConnected(false);
    });

    socket.on('error', (data: { message: string }) => {
      console.error('[Socket.IO] ❌ Socket error:', data.message);
      setError(data.message);
    });

    return () => {
      console.log('[Socket.IO] Cleaning up connection');
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
    };
  }, [token, enabled, workspaceId]);

  return {
    socket: socketState,
    isConnected,
    error,
  };
}
