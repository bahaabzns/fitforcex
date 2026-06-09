import { Router, Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { loginLimiter } from '../../middleware/rateLimit';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../lib/email';
import authMiddleware from '../../middleware/auth';
import requireOwner from '../../middleware/requireOwner';
import { env } from '../../config/env';
import pool from '../../db';

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

async function buildTokenForWorkspace(userId: string, workspaceId: string) {
    const { rows } = await pool.query(
        `SELECT w.id AS workspace_id, w.slug, w.name, w.owner_id,
                wm.role, wm.permissions, wm.is_active
         FROM workspaces w
         LEFT JOIN workspace_members wm
               ON wm.workspace_id = w.id AND wm.user_id = $1
         WHERE w.id = $2 AND w.archived_at IS NULL`,
        [userId, workspaceId]
    );

    if (!rows.length) throw { status: 403, message: 'Workspace not found or archived' };
    const ws = rows[0] as Row;
    const isOwner = ws.owner_id === userId;

    if (!isOwner && !ws.role)      throw { status: 403, message: 'You do not have access to this workspace' };
    if (!isOwner && !ws.is_active) throw { status: 403, message: 'Your membership in this workspace is inactive' };

    return {
        workspaceId: ws.workspace_id as string,
        slug:        ws.slug as string,
        name:        ws.name as string,
        role:        isOwner ? 'owner' : (ws.role as string),
        permissions: isOwner ? null : ws.permissions,
    };
}

async function buildToken(userId: string) {
    const { rows: userRows } = await pool.query(
        'SELECT default_workspace_id FROM users WHERE id = $1',
        [userId]
    );
    const defaultWorkspaceId = (userRows[0] as Row)?.default_workspace_id as string | undefined;

    if (defaultWorkspaceId) {
        try {
            return await buildTokenForWorkspace(userId, defaultWorkspaceId);
        } catch {
            // default workspace may have been archived — fall through to any owned workspace
        }
    }

    const { rows: fallback } = await pool.query(
        'SELECT id FROM workspaces WHERE owner_id = $1 AND archived_at IS NULL ORDER BY created_at LIMIT 1',
        [userId]
    );
    if (!fallback.length) throw new Error('No accessible workspace found');

    const wsId = (fallback[0] as Row).id as string;
    return await buildTokenForWorkspace(userId, wsId);
}

async function fetchUserWorkspaces(userId: string) {
    const { rows: owned } = await pool.query(
        `SELECT w.id, w.slug, w.name, 'owner' AS role, NULL::jsonb AS permissions
         FROM workspaces w
         WHERE w.owner_id = $1 AND w.archived_at IS NULL
         ORDER BY w.created_at`,
        [userId]
    );

    const { rows: member } = await pool.query(
        `SELECT w.id, w.slug, w.name, wm.role, wm.permissions
         FROM workspace_members wm
         JOIN workspaces w ON w.id = wm.workspace_id
         WHERE wm.user_id = $1 AND wm.is_active = TRUE AND w.archived_at IS NULL
         ORDER BY wm.joined_at`,
        [userId]
    );

    return [...owned, ...member];
}

async function fetchPendingInvitationsCount(userId: string): Promise<number> {
    const { rows } = await pool.query(
        `SELECT COUNT(*) AS count FROM workspace_invitations
         WHERE invited_user_id = $1 AND status = 'pending'`,
        [userId]
    );
    return parseInt((rows[0] as Row).count as string);
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
    await pool.query(
        `UPDATE users
         SET email_verification_code = $1, verification_code_expires_at = $2
         WHERE id = $3`,
        [code, expiresAt, userId]
    );
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

        const hashed = await bcrypt.hash(password, 10);

        const rawSlug       = email.split('@')[0] || `${fname}-${lname}`;
        const normalizedSlug = normalizeSlug(rawSlug) || `coach-${Date.now()}`;

        const { rows: slugRows } = await pool.query(
            'SELECT slug FROM workspaces WHERE slug = $1',
            [normalizedSlug]
        );
        const slug = slugRows.length > 0 ? `${normalizedSlug}-${Date.now()}` : normalizedSlug;

        const userId = createId();
        const userResult = await pool.query(
            'INSERT INTO users (id, fname, lname, email, password, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, fname, lname, email',
            [userId, fname, lname, email, hashed, phone?.trim() || null]
        );
        const user = userResult.rows[0] as Row;

        const workspaceId = createId();
        await pool.query(
            `INSERT INTO workspaces (id, slug, name, owner_id, slug_customized, created_at)
             VALUES ($1, $2, $3, $4, FALSE, NOW())`,
            [workspaceId, slug, `${fname}'s Workspace`, user.id]
        );

        await pool.query(
            'UPDATE users SET default_workspace_id = $1 WHERE id = $2',
            [workspaceId, user.id]
        );

        await pool.query(
            `INSERT INTO workspace_subscriptions (id, workspace_id, plan_id, expires_at)
             SELECT $1, $2, p.id,
                    CASE WHEN p.trial_days IS NOT NULL THEN NOW() + (p.trial_days || ' days')::interval ELSE NULL END
             FROM plans p WHERE p.is_default = TRUE LIMIT 1`,
            [createId(), workspaceId]
        );

        await storeAndSendVerificationCode(user.id as string, user.email as string);

        res.status(201).json({
            id:             user.id,
            fname:          user.fname,
            lname:          user.lname,
            email:          user.email,
            workspace_slug: slug,
        });
    } catch (err) {
        const pgErr = err as { code?: string; constraint?: string };
        if (pgErr.code === '23505' && pgErr.constraint === 'users_email_key') {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }
        next(err);
    }
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as { email?: string; password?: string };

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (!result.rows.length) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user  = result.rows[0] as Row;
        const match = await bcrypt.compare(password!, user.password as string);
        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const wsContext = await buildToken(user.id as string);
        const [workspaces, pendingInvitationsCount] = await Promise.all([
            fetchUserWorkspaces(user.id as string),
            fetchPendingInvitationsCount(user.id as string),
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
               selectedWorkspace: {
                   id:   wsContext.workspaceId,
                   slug: wsContext.slug,
                   name: wsContext.name,
                   role: wsContext.role,
               },
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

        const { rows } = await pool.query(
            'SELECT id, fname, lname, email, default_workspace_id, email_verified, preferred_language FROM users WHERE id = $1',
            [decoded.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const user = rows[0] as Row;

        const [wsContext, workspaces, pendingInvitationsCount] = await Promise.all([
            buildTokenForWorkspace(user.id as string, decoded.workspaceId),
            fetchUserWorkspaces(user.id as string),
            fetchPendingInvitationsCount(user.id as string),
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

        const token = issueToken({
            userId:      req.user!.userId,
            workspaceId: wsContext.workspaceId,
            role:        wsContext.role,
            permissions: wsContext.permissions,
        });

        res.cookie('token', token, cookieOptions())
           .status(200)
           .json({
               workspace: {
                   id:   wsContext.workspaceId,
                   slug: wsContext.slug,
                   name: wsContext.name,
                   role: wsContext.role,
               },
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
        await pool.query(
            'UPDATE users SET default_workspace_id = $1 WHERE id = $2',
            [workspaceId, req.user!.userId]
        );
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
        const wsCheck = await pool.query(
            'SELECT slug_customized FROM workspaces WHERE id = $1',
            [req.user!.workspaceId]
        );
        if (!wsCheck.rows.length) return res.status(404).json({ message: 'Workspace not found' });
        if ((wsCheck.rows[0] as Row).slug_customized) {
            return res.status(403).json({ message: 'Slug customization is only allowed once' });
        }

        const normalized = normalizeSlug(new_slug);
        if (!normalized) return res.status(400).json({ message: 'Slug must contain alphanumeric characters' });

        const conflict = await pool.query(
            'SELECT id FROM workspaces WHERE slug = $1 AND id != $2',
            [normalized, req.user!.workspaceId]
        );
        if (conflict.rows.length) return res.status(409).json({ message: 'Slug is already taken' });

        const result = await pool.query(
            'UPDATE workspaces SET slug = $1, slug_customized = TRUE WHERE id = $2 RETURNING id, slug, slug_customized',
            [normalized, req.user!.workspaceId]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.post('/send-verification', authMiddleware, loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, email, email_verified FROM users WHERE id = $1',
            [req.user!.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const user = rows[0] as Row;

        if (user.email_verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        await storeAndSendVerificationCode(user.id as string, user.email as string);
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
        const { rows } = await pool.query(
            `SELECT id, email_verified, email_verification_code, verification_code_expires_at
             FROM users WHERE id = $1`,
            [req.user!.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const user = rows[0] as Row;

        if (user.email_verified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }
        if (!user.email_verification_code || user.email_verification_code !== code.trim()) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        if (!user.verification_code_expires_at || new Date(user.verification_code_expires_at as string) < new Date()) {
            return res.status(400).json({ message: 'Verification code has expired — request a new one' });
        }

        await pool.query(
            `UPDATE users
             SET email_verified = TRUE,
                 email_verification_code = NULL,
                 verification_code_expires_at = NULL
             WHERE id = $1`,
            [req.user!.userId]
        );

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
        const { rows } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (rows.length) {
            const userId = (rows[0] as Row).id as string;
            const code      = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await pool.query(
                `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
                [userId]
            );

            await pool.query(
                `INSERT INTO password_reset_tokens (id, user_id, code, expires_at) VALUES ($1, $2, $3, $4)`,
                [createId(), userId, code, expiresAt]
            );

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
        const { rows: userRows } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );
        if (!userRows.length) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }
        const userId = (userRows[0] as Row).id as string;

        const { rows: tokenRows } = await pool.query(
            `SELECT id FROM password_reset_tokens
             WHERE user_id = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [userId, code.trim()]
        );
        if (!tokenRows.length) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
        await pool.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
            [(tokenRows[0] as Row).id]
        );

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
        const { rows } = await pool.query(
            'SELECT id, fname, lname, password FROM users WHERE id = $1',
            [req.user!.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const user = rows[0] as Row;

        const updates: Record<string, unknown> = {};

        if (fname?.trim())  updates.fname = fname.trim();
        if (lname !== undefined) updates.lname = lname?.trim() ?? '';
        if (preferred_language === 'en' || preferred_language === 'ar') updates.preferred_language = preferred_language;

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new one' });
            }
            const valid = await bcrypt.compare(currentPassword, user.password as string);
            if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
            updates.password = await bcrypt.hash(newPassword, 10);
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({ message: 'Nothing to update' });
        }

        const params: unknown[] = [];
        const setClauses = Object.keys(updates).map((k) => {
            params.push(updates[k]);
            return `${k} = $${params.length}`;
        });
        params.push(req.user!.userId);

        const { rows: updated } = await pool.query(
            `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING id, fname, lname, email, preferred_language`,
            params
        );

        res.json(updated[0]);
    } catch (err) {
        next(err);
    }
});

export default router;
