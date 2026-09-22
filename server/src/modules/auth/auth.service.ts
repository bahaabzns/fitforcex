import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { sendVerificationEmail } from '../../lib/email';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { normalizeEmail } from '../../utils/email';

// Thrown by assertEmailPhoneAvailable — controllers catch this and respond with
// { status, message } instead of falling through to the generic error handler.
export class SignupFieldError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export type WsContextRow = {
    workspace_id: string; slug: string; name: string; owner_id: string;
    role: string | null; permissions: unknown; is_active: boolean | null;
};

export type WorkspaceListRow = { id: string; slug: string; name: string; role: string; permissions: unknown };

export function cookieOptions() {
    return {
        httpOnly: true,
        secure:   env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
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

// Shared by register() (step 2 — actually creates the account) and the
// checkout wizard's step-1 "can I use this email/phone" pre-check, so the two
// never drift on what counts as valid/available. Throws SignupFieldError on
// the first failing rule; never writes anything.
export async function assertEmailPhoneAvailable(
    email: string | undefined, phone: string | undefined,
): Promise<{ normalizedEmail: string; trimmedPhone: string }> {
    if (!email || typeof email !== 'string' || !email.trim()) {
        throw new SignupFieldError(400, 'Email is required');
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw new SignupFieldError(400, 'Invalid email format');
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
        throw new SignupFieldError(400, 'Phone number is required');
    }

    const normalizedEmail = normalizeEmail(email);
    const trimmedPhone = phone.trim();

    // Email and phone must each be unique across coaches. (email has a DB unique
    // constraint; phone does not, so it's enforced here.) Email is matched
    // case-insensitively so "John@x.com" and "john@x.com" collide.
    const existing = await prisma.users.findFirst({
        where:  { OR: [{ email: { equals: normalizedEmail, mode: 'insensitive' } }, { phone: trimmedPhone }] },
        select: { email: true, phone: true },
    });
    if (existing) {
        const message = normalizeEmail(existing.email) === normalizedEmail
            ? 'An account with this email already exists'
            : 'An account with this phone number already exists';
        throw new SignupFieldError(409, message);
    }

    return { normalizedEmail, trimmedPhone };
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

    const ownedFallback = await prisma.workspaces.findFirst({
        where:   { owner_id: userId, archived_at: null },
        orderBy: { created_at: 'asc' },
        select:  { id: true },
    });
    if (ownedFallback) return await buildTokenForWorkspace(userId, ownedFallback.id);

    const membershipFallback = await prisma.workspace_members.findFirst({
        where:   { user_id: userId, is_active: true, workspaces: { archived_at: null } },
        orderBy: { joined_at: 'asc' },
        select:  { workspace_id: true },
    });
    if (!membershipFallback) throw { status: 403, message: 'No accessible workspace found' };

    return await buildTokenForWorkspace(userId, membershipFallback.workspace_id);
}

export async function fetchUserWorkspaces(userId: string): Promise<WorkspaceListRow[]> {
    return prisma.$queryRaw<WorkspaceListRow[]>`
        SELECT w.id, w.slug, w.name, 'owner' AS role, NULL::jsonb AS permissions
        FROM workspaces w
        WHERE w.owner_id = ${userId} AND w.archived_at IS NULL
        UNION ALL
        SELECT w.id, w.slug, w.name, wm.role, wm.permissions
        FROM workspace_members wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = ${userId} AND wm.is_active = TRUE AND w.archived_at IS NULL
        ORDER BY name
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
