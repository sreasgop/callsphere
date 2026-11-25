import { io, type Socket } from 'socket.io-client';

export type ConnectionState = 'connecting' | 'online' | 'offline';

export function createSignalingSocket(): Socket {
  return io('/', {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 5000,
  });
}
