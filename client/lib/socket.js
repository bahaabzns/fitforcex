import { io } from 'socket.io-client';
import { isDemoFrame } from '@/lib/axios';

// Lazy singleton — the cookie-based JWT auth and workspace/user room joins are
// handled server-side (lib/socket.ts on connect), so any consumer just needs
// the same connection, not its own. Not torn down on unmount: a second
// consumer (e.g. a notifications bell) should reuse this same connection
// rather than opening another one.
let socket = null;

// In the landing-page demo there is no server to connect to: a silent stand-in keeps the chat code happy.
const DEMO_SOCKET = { on() {}, off() {}, emit() {}, connect() {}, disconnect() {}, connected: false };

export function getSocket() {
    if (isDemoFrame()) return DEMO_SOCKET;
    if (!socket) {
        socket = io(process.env.NEXT_PUBLIC_API_URL, { withCredentials: true });
    }
    return socket;
}
