import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

interface WsContextValue {
  connected: boolean;
  on: (event: string, handler: (data: unknown) => void) => () => void;
}

const WsContext = createContext<WsContextValue>({ connected: false, on: () => () => {} });

export function WsProvider({ url, children }: { url: string; children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(url, { reconnection: true, reconnectionDelay: 1000 });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => { socket.disconnect(); };
  }, [url]);

  const on = (event: string, handler: (data: unknown) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  };

  return <WsContext.Provider value={{ connected, on }}>{children}</WsContext.Provider>;
}

export function useWs() { return useContext(WsContext); }
