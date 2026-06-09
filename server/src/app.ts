import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';

import { env } from './config/env';
import { readLimiter, mutationLimiter } from './middleware/rateLimit';

import authRouter        from './modules/auth/index';
import dashboardRouter   from './modules/dashboard/index';
import messengerRouter   from './modules/messenger/index';
import clientsRouter     from './modules/clients/index';
import nutritionRouter   from './modules/nutrition/index';
import trainingRouter    from './modules/training/index';
import clientPortalRouter from './modules/clientPortal/index';
import formsRouter       from './modules/forms/index';
import packagesRouter    from './modules/packages/index';
import paymentMethodsRouter from './modules/paymentMethods/index';
import transactionsRouter from './modules/transactions/index';
import plansRouter       from './modules/plans/index';
import adminRouter       from './modules/admin/index';
import workspacesRouter  from './modules/workspaces/index';
import invitationsRouter from './modules/invitations/index';
import billingRouter     from './modules/billing/index';
import paymentsWebhookRouter from './modules/paymentsWebhook/index';

Sentry.init({
    dsn:         env.SENTRY_DSN,
    environment: env.NODE_ENV,
    enabled:     !!env.SENTRY_DSN,
});

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || env.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));

// Webhook registered BEFORE express.json() — needs raw body for HMAC verification
app.use('/api/payments/webhook', paymentsWebhookRouter);

app.use(express.json());
app.use(cookieParser());

// GETs get a generous cap; mutations get the tighter limit
const apiLimiter = (req: Request, res: Response, next: NextFunction) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    return isMutation ? mutationLimiter(req, res, next) : readLimiter(req, res, next);
};

app.use('/api/auth',           authRouter);
app.use('/api/dashboard',      dashboardRouter);
app.use('/api/messenger',      mutationLimiter, messengerRouter);
app.use('/api/clients',        apiLimiter, clientsRouter);
app.use('/api/nutrition',      apiLimiter, nutritionRouter);
app.use('/api/training',       apiLimiter, trainingRouter);
app.use('/api/client-portal',  apiLimiter, clientPortalRouter);
app.use('/api/forms',          apiLimiter, formsRouter);
app.use('/api/packages',       apiLimiter, packagesRouter);
app.use('/api/payment-methods',apiLimiter, paymentMethodsRouter);
app.use('/api/transactions',   apiLimiter, transactionsRouter);
app.use('/api/plans',          plansRouter);
app.use('/api/admin',          apiLimiter, adminRouter);
app.use('/api/workspaces',     apiLimiter, workspacesRouter);
app.use('/api/invitations',    apiLimiter, invitationsRouter);
app.use('/api/billing',        apiLimiter, billingRouter);

app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'All is good!' });
});

// Global error handler
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
        console.error({ err }, 'Unhandled server error');
        Sentry.captureException(err);
    }
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});

export default app;
