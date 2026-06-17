import http from 'http';
import crypto from 'crypto';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createId } from '@paralleldrive/cuid2';
import app from '../../src/app';
import { initSocket } from '../../src/lib/socket';
import { testPrisma } from './testDb';

// Initialize Socket.io on a non-listening http server so getIo() doesn't throw
// in endpoints that call getIo().emit() (e.g. sendMessage, activatePlan).
const httpServer = http.createServer(app);
initSocket(httpServer);

export const request = supertest(app);

export async function createTestUser(overrides: Record<string, unknown> = {}) {
    return testPrisma.users.create({
        data: {
            id:             createId(),
            fname:          'Test',
            lname:          'Coach',
            email:          `coach-${createId()}@test.com`,
            password:       await bcrypt.hash('password123', 10),
            email_verified: true,
            ...overrides,
        },
    });
}

export async function createTestWorkspace(ownerId: string) {
    return testPrisma.workspaces.create({
        data: {
            id:       createId(),
            name:     'Test Workspace',
            slug:     `ws-${createId()}`,
            owner_id: ownerId,
        },
    });
}

// Creates a JWT and stores the matching session hash in user_sessions so the
// authMiddleware session check (which validates against the DB) passes.
export async function makeAuthCookie(userId: string, workspaceId: string, role = 'owner'): Promise<string> {
    const token = jwt.sign(
        { userId, workspaceId, role, permissions: null },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
    );
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await testPrisma.user_sessions.create({
        data: {
            id:         createId(),
            user_id:    userId,
            token_hash: tokenHash,
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
        },
    });
    return `token=${token}`;
}

// Client-portal identity: a plain JWT in the `client_token` cookie. The client
// auth middleware verifies the JWT only (no session row), so no DB write needed.
export function makeClientCookie(clientId: string, workspaceId: string): string {
    const token = jwt.sign({ clientId, workspaceId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    return `client_token=${token}`;
}
