import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isAllowedOrigin } from './cors';

let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
    io = new SocketServer(httpServer, {
        cors: {
            origin: (origin, cb) =>
                isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`CORS: ${origin} not allowed`)),
            credentials: true,
        },
    });

    io.use((socket, next) => {
        const cookieHeader = socket.handshake.headers?.cookie ?? '';
        const token = cookieHeader
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('token='))
            ?.split('=')[1];

        if (!token) return next(new Error('Not authenticated'));

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
            socket.data.userId      = decoded.userId;
            socket.data.workspaceId = decoded.workspaceId;
            socket.data.clientId    = decoded.clientId ?? null;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const { userId, workspaceId, clientId } = socket.data as {
            userId: string;
            workspaceId: string;
            clientId: string | null;
        };

        if (workspaceId) socket.join(`workspace:${workspaceId}`);
        if (clientId)    socket.join(`client:${clientId}`);
        if (userId)      socket.join(`user:${userId}`);
    });

    return io;
}

export function getIo(): SocketServer {
    if (!io) throw new Error('Socket.io not initialised — call initSocket() first');
    return io;
}
