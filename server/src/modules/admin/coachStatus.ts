import { Prisma } from '@prisma/client';

export type CoachStatus = 'free' | 'subscribed' | 'expired';

export const FREE_PLAN_NAME = 'free';

// FitForce is freemium (free forever up to a client cap), so there is no trial state:
//   subscribed → on a paid plan that has not run out
//   expired    → was a paid customer and no longer is (plan ran out, or dropped back to Free);
//                a 0 EGP free grant does not make someone a past customer
//   free       → never paid
// Expects the surrounding query to alias workspaces as `w`, workspace_subscriptions as `ws`
// and that subscription's plan as `sp`.
// Plain text so it can be embedded in queries built as strings; FREE_PLAN_NAME is a code constant,
// never user input. COACH_STATUS_SQL is the same text as a fragment for tagged-template queries.
export const COACH_STATUS_SQL_TEXT = `
    CASE
        WHEN sp.name IS NOT NULL AND sp.name <> '${FREE_PLAN_NAME}' AND (ws.expires_at IS NULL OR ws.expires_at > now()) THEN 'subscribed'
        WHEN sp.name IS NOT NULL AND sp.name <> '${FREE_PLAN_NAME}' THEN 'expired'
        WHEN EXISTS (
            SELECT 1 FROM workspace_payments wp
            WHERE wp.workspace_id = w.id AND wp.gateway_status = 'paid' AND wp.addon_id IS NULL AND wp.amount > 0
        ) THEN 'expired'
        ELSE 'free'
    END
`;

export const COACH_STATUS_SQL = Prisma.raw(COACH_STATUS_SQL_TEXT);
