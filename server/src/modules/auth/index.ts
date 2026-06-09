import { Router, Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { loginLimiter } from '../../middleware/rateLimit';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../lib/email';
import authMiddleware from '../../middleware/auth';
import requireOwner from '../../middleware/requireOwner';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

const router = Router();

type Row = Record<string, unknown>;

function cookieOptions() {
    return {
        httpOnly: true,
        secure:   env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge:   7 * 24 * 60 * 60 * 1000,
    };
}

function normalizeSlug(raw: string): string {
    return raw
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

type WsContextRow = {
    workspace_id: string; slug: string; name: string; owner_id: string;
    role: string | null; permissions: unknown; is_active: boolean | null;
};

async function buildTokenForWorkspace(userId: string, workspaceId: string) {
    const rows = await prisma.$queryRaw<WsContextRow[]>`
        SELECT w.id AS workspace_id, w.slug, w.name, w.owner_id,
               wm.role, wm.permissions, wm.is_active
        FROM workspaces w
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ${userId}
        WHERE w.id = ${workspaceId} AND w.archived_at IS NULL
    `;

    if (!rows.length) throw { status: 403, message: 'Workspace not found or archived' };
    const ws       = rows[0];
    const isOwner  = ws.owner_id === userId;

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

type WorkspaceListRow = { id: string; slug: string; name: string; role: string; permissions: unknown };

async function buildToken(userId: string) {
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

async function fetchUserWorkspaces(userId: string): Promise<WorkspaceListRow[]> {
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

async function fetchPendingInvitationsCount(userId: string): Promise<number> {
    return prisma.workspace_invitations.count({
        where: { invited_user_id: userId, status: 'pending' },
    });
}

function issueToken(payload: Record<string, unknown>): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

function generateVerificationCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function storeAndSendVerificationCode(userId: string, email: string): Promise<void> {
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

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fname, lname, email, password, phone } = req.body as Record<string, string | undefined>;

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        if (!password || typeof password !== 'string' || !password.trim()) {
            return res.status(400).json({ message: 'Password is required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        const hashed        = await bcrypt.hash(password, 10);
        const rawSlug       = email.split('@')[0] || `${fname}-${lname}`;
        const normalizedSlug = normalizeSlug(rawSlug) || `coach-${Date.now()}`;

        const slugConflict = await prisma.workspaces.findFirst({
            where: { slug: normalizedSlug },
            select: { slug: true },
        });
        const slug = slugConflict ? `${normalizedSlug}-${Date.now()}` : normalizedSlug;

        const userId      = createId();
        const workspaceId = createId();

        try {
            const [user] = await prisma.$transaction(async (tx) => {
                const newUser = await tx.users.create({
                    data: {
                        id: userId, fname: fname || '', lname: lname || '',
                        email: email.trim(), password: hashed,
                        phone: phone?.trim() || null,
                    },
                    select: { id: true, fname: true, lname: true, email: true },
                });

                await tx.workspaces.create({
                    data: {
                        id: workspaceId, slug, name: `${fname}'s Workspace`,
                        owner_id: newUser.id, slug_customized: false,
                    },
                });

                await tx.users.update({
                    where: { id: newUser.id },
                    data:  { default_workspace_id: workspaceId },
                });

                const defaultPlan = await tx.plans.findFirst({
                    where:  { is_default: true },
                    select: { id: true, trial_days: true },
                });

                if (defaultPlan) {
                    const expiresAt = defaultPlan.trial_days
                        ? new Date(Date.now() + Number(defaultPlan.trial_days) * 86400000)
                        : null;
                    await tx.workspace_subscriptions.create({
                        data: {
                            id: createId(), workspace_id: workspaceId, plan_id: defaultPlan.id,
                            expires_at: expiresAt,
                        },
                    });
                }

                return [newUser];
            });

            await storeAndSendVerificationCode(userId, email.trim());

            res.status(201).json({
                id: user.id, fname: user.fname, lname: user.lname,
                email: user.email, workspace_slug: slug,
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                return res.status(409).json({ message: 'An account with this email already exists' });
            }
            throw err;
        }
    } catch (err) {
        next(err);
    }
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as { email?: string; password?: string };

    try {
        const user = await prisma.users.findFirst({ where: { email: email! } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password!, user.password!);
        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const wsContext = await buildToken(user.id);
        const [workspaces, pendingInvitationsCount] = await Promise.all([
            fetchUserWorkspaces(user.id),
            fetchPendingInvitationsCount(user.id),
        ]);

        const token = issueToken({
            userId:      user.id,
            workspaceId: wsContext.workspaceId,
            role:        wsContext.role,
            permissions: wsContext.permissions,
        });

        res.cookie('token', token, cookieOptions())
           .status(200)
           .json({
               message: 'Login successful',
               selectedWorkspace: { id: wsContext.workspaceId, slug: wsContext.slug, name: wsContext.name, role: wsContext.role },
               workspaces,
               pendingInvitationsCount,
           });
    } catch (err) {
        next(err);
    }
});

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.token as string | undefined;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; workspaceId: string };

        const user = await prisma.users.findFirst({
            where:  { id: decoded.userId },
            select: { id: true, fname: true, lname: true, email: true, default_workspace_id: true, email_verified: true, preferred_language: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const [wsContext, workspaces, pendingInvitationsCount] = await Promise.all([
            buildTokenForWorkspace(user.id, decoded.workspaceId),
            fetchUserWorkspaces(user.id),
            fetchPendingInvitationsCount(user.id),
        ]);

        res.status(200).json({
            userId:           user.id,
            fname:            user.fname,
            lname:            user.lname,
            email:            user.email,
            emailVerified:    user.email_verified,
            currentWorkspace: {
                id:          wsContext.workspaceId,
                slug:        wsContext.slug,
                name:        wsContext.name,
                role:        wsContext.role,
                permissions: wsContext.permissions,
            },
            workspaces,
            pendingInvitationsCount,
            defaultWorkspaceId: user.default_workspace_id,
            preferredLanguage:  user.preferred_language,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/switch-workspace', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { workspaceId } = req.body as { workspaceId?: string };
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    try {
        const wsContext = await buildTokenForWorkspace(req.user!.userId, workspaceId);
        const token     = issueToken({
            userId:      req.user!.userId,
            workspaceId: wsContext.workspaceId,
            role:        wsContext.role,
            permissions: wsContext.permissions,
        });

        res.cookie('token', token, cookieOptions())
           .status(200)
           .json({
               workspace: { id: wsContext.workspaceId, slug: wsContext.slug, name: wsContext.name, role: wsContext.role },
           });
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
});

router.put('/default-workspace', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { workspaceId } = req.body as { workspaceId?: string };
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    try {
        await buildTokenForWorkspace(req.user!.userId, workspaceId);
        await prisma.users.update({
            where: { id: req.user!.userId },
            data:  { default_workspace_id: workspaceId },
        });
        res.json({ message: 'Default workspace updated' });
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
});

router.put('/workspace-slug', authMiddleware, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
    const { new_slug } = req.body as { new_slug?: string };
    if (!new_slug?.trim()) return res.status(400).json({ message: 'Slug is required' });

    try {
        const ws = await prisma.workspaces.findFirst({
            where:  { id: req.user!.workspaceId },
            select: { slug_customized: true },
        });
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });
        if (ws.slug_customized) {
            return res.status(403).json({ message: 'Slug customization is only allowed once' });
        }

        const normalized = normalizeSlug(new_slug);
        if (!normalized) return res.status(400).json({ message: 'Slug must contain alphanumeric characters' });

        const conflict = await prisma.workspaces.findFirst({
            where: { slug: normalized, id: { not: req.user!.workspaceId } },
            select: { id: true },
        });
        if (conflict) return res.status(409).json({ message: 'Slug is already taken' });

        const updated = await prisma.workspaces.update({
            where: { id: req.user!.workspaceId },
            data:  { slug: normalized, slug_customized: true },
            select: { id: true, slug: true, slug_customized: true },
        });
        res.status(200).json(updated);
    } catch (err) {
        next(err);
    }
});

router.post('/send-verification', authMiddleware, loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await prisma.users.findFirst({
            where:  { id: req.user!.userId },
            select: { id: true, email: true, email_verified: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.email_verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        await storeAndSendVerificationCode(user.id, user.email!);
        res.json({ message: 'Verification code sent. Check your email.' });
    } catch (err) {
        next(err);
    }
});

router.post('/verify-email', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ message: 'Verification code is required' });
    }

    try {
        const user = await prisma.users.findFirst({
            where:  { id: req.user!.userId },
            select: { id: true, email_verified: true, email_verification_code: true, verification_code_expires_at: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.email_verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }
        if (!user.email_verification_code || user.email_verification_code !== code.trim()) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        if (!user.verification_code_expires_at || new Date(user.verification_code_expires_at) < new Date()) {
            return res.status(400).json({ message: 'Verification code has expired — request a new one' });
        }

        await prisma.users.update({
            where: { id: req.user!.userId },
            data:  { email_verified: true, email_verification_code: null, verification_code_expires_at: null },
        });

        res.json({ message: 'Email verified successfully' });
    } catch (err) {
        next(err);
    }
});

router.post('/forgot-password', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const user = await prisma.users.findFirst({
            where:  { email: email.trim().toLowerCase() },
            select: { id: true },
        });

        if (user) {
            const code      = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await prisma.password_reset_tokens.updateMany({
                where: { user_id: user.id, used_at: null },
                data:  { used_at: new Date() },
            });

            await prisma.password_reset_tokens.create({
                data: { id: createId(), user_id: user.id, code, expires_at: expiresAt },
            });

            sendPasswordResetEmail(email.trim(), code).catch((err: Error) => {
                console.error('[forgot-password] email send failed:', err.message);
            });
        }

        res.json({ message: 'If that email is registered, a reset code has been sent.' });
    } catch (err) {
        next(err);
    }
});

router.post('/reset-password', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const { email, code, newPassword } = req.body as { email?: string; code?: string; newPassword?: string };
    if (!email || !code || !newPassword) {
        return res.status(400).json({ message: 'Email, code, and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    try {
        const user = await prisma.users.findFirst({
            where:  { email: email.trim().toLowerCase() },
            select: { id: true },
        });
        if (!user) return res.status(400).json({ message: 'Invalid or expired reset code' });

        const token = await prisma.password_reset_tokens.findFirst({
            where: {
                user_id: user.id, code: code.trim(), used_at: null,
                expires_at: { gt: new Date() },
            },
            orderBy: { created_at: 'desc' },
            select:  { id: true },
        });
        if (!token) return res.status(400).json({ message: 'Invalid or expired reset code' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.users.update({ where: { id: user.id }, data: { password: hashed } });
        await prisma.password_reset_tokens.update({ where: { id: token.id }, data: { used_at: new Date() } });

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie('token').status(200).json({ message: 'Logged out successfully' });
});

router.patch('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { fname, lname, currentPassword, newPassword, preferred_language } = req.body as Record<string, string | undefined>;

    if (!fname?.trim() && !lname?.trim() && !newPassword && !preferred_language) {
        return res.status(400).json({ message: 'Nothing to update' });
    }

    try {
        const user = await prisma.users.findFirst({
            where:  { id: req.user!.userId },
            select: { id: true, fname: true, lname: true, password: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const data: Record<string, unknown> = {};

        if (fname?.trim())   data.fname = fname.trim();
        if (lname !== undefined) data.lname = lname?.trim() ?? '';
        if (preferred_language === 'en' || preferred_language === 'ar') data.preferred_language = preferred_language;

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new one' });
            }
            const valid = await bcrypt.compare(currentPassword, user.password!);
            if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
            data.password = await bcrypt.hash(newPassword, 10);
        }

        if (!Object.keys(data).length) {
            return res.status(400).json({ message: 'Nothing to update' });
        }

        const updated = await prisma.users.update({
            where:  { id: req.user!.userId },
            data:   data as Prisma.usersUpdateInput,
            select: { id: true, fname: true, lname: true, email: true, preferred_language: true },
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
});

export default router;
