import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { sendVerificationEmail } from '../../lib/email';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

export type WsContextRow = {
    workspace_id: string; slug: string; name: string; owner_id: string;
    role: string | null; permissions: unknown; is_active: boolean | null;
};

export type WorkspaceListRow = { id: string; slug: string; name: string; role: string; permissions: unknown };

export function cookieOptions() {
    return {
        httpOnly: true,
        secure:   env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge:   7 * 24 * 60 * 60 * 1000,
    };
}

export function normalizeSlug(raw: string): string {
    return raw
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export async function buildTokenForWorkspace(userId: string, workspaceId: string) {
    const rows = await prisma.$queryRaw<WsContextRow[]>`
        SELECT w.id AS workspace_id, w.slug, w.name, w.owner_id,
               wm.role, wm.permissions, wm.is_active
        FROM workspaces w
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ${userId}
        WHERE w.id = ${workspaceId} AND w.archived_at IS NULL
    `;

    if (!rows.length) throw { status: 403, message: 'Workspace not found or archived' };
    const ws      = rows[0];
    const isOwner = ws.owner_id === userId;

    if (!isOwner && !ws.role)      throw { status: 403, message: 'You do not have access to this workspace' };
    if (!isOwner && !ws.is_active) throw { status: 403, message: 'Your membership in this workspace is inactive' };

    return {
        workspaceId: ws.workspace_id,
        slug:        ws.slug,
        name:        ws.name,
        role:        isOwner ? 'owner' : ws.role!,
        permissions: isOwner ? null : ws.permissions,
    };
}

export async function buildToken(userId: string) {
    const user = await prisma.users.findFirst({
        where:  { id: userId },
        select: { default_workspace_id: true },
    });
    const defaultWorkspaceId = user?.default_workspace_id;

    if (defaultWorkspaceId) {
        try {
            return await buildTokenForWorkspace(userId, defaultWorkspaceId);
        } catch {
            // default workspace may have been archived — fall through to any owned workspace
        }
    }

    const fallback = await prisma.workspaces.findFirst({
        where:   { owner_id: userId, archived_at: null },
        orderBy: { created_at: 'asc' },
        select:  { id: true },
    });
    if (!fallback) throw new Error('No accessible workspace found');

    return await buildTokenForWorkspace(userId, fallback.id);
}

export async function fetchUserWorkspaces(userId: string): Promise<WorkspaceListRow[]> {
    return prisma.$queryRaw<WorkspaceListRow[]>`
        SELECT w.id, w.slug, w.name, 'owner' AS role, NULL::jsonb AS permissions
        FROM workspaces w
        WHERE w.owner_id = ${userId} AND w.archived_at IS NULL
        ORDER BY w.created_at
        UNION ALL
        SELECT w.id, w.slug, w.name, wm.role, wm.permissions
        FROM workspace_members wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = ${userId} AND wm.is_active = TRUE AND w.archived_at IS NULL
        ORDER BY 1
    `;
}

export async function fetchPendingInvitationsCount(userId: string): Promise<number> {
    return prisma.workspace_invitations.count({
        where: { invited_user_id: userId, status: 'pending' },
    });
}

export function issueToken(payload: Record<string, unknown>): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function generateVerificationCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, token: string): Promise<void> {
    await prisma.user_sessions.create({
        data: {
            id:         createId(),
            user_id:    userId,
            token_hash: hashToken(token),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });
}

export async function revokeSession(token: string): Promise<void> {
    await prisma.user_sessions.updateMany({
        where: { token_hash: hashToken(token) },
        data:  { revoked_at: new Date() },
    });
}

export async function storeAndSendVerificationCode(userId: string, email: string): Promise<void> {
    const code      = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.users.update({
        where: { id: userId },
        data:  { email_verification_code: code, verification_code_expires_at: expiresAt },
    });
    sendVerificationEmail(email, code).catch((err: Error) => {
        console.error('[email-verification] send failed:', err.message);
    });
}
