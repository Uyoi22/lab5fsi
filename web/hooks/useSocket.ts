'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'ebookstore_token';

export interface OrderUpdateEvent {
  orderId: string;
  status: string;
  shippingStatus: string;
  updatedAt: string;
}

interface UseSocketReturn {
  isConnected: boolean;
  lastOrderUpdate: OrderUpdateEvent | null;
  clearLastUpdate: () => void;
}

export const useSocket = (token: string | null): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastOrderUpdate, setLastOrderUpdate] = useState<OrderUpdateEvent | null>(null);

  useEffect(() => {
    // No conectar si no hay token
    const resolvedToken = token || (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
    if (!resolvedToken) return;

    // Crear conexión con auth
    const socket = io(SOCKET_URL, {
      auth: { token: resolvedToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('order:updated', (payload: OrderUpdateEvent) => {
      setLastOrderUpdate(payload);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket.IO error de conexión:', err.message);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token]);

  const clearLastUpdate = useCallback(() => {
    setLastOrderUpdate(null);
  }, []);

  return { isConnected, lastOrderUpdate, clearLastUpdate };
};
