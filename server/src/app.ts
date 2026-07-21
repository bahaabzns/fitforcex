import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import * as Sentry from '@sentry/node';

import { env } from './config/env';
import { isAllowedOrigin } from './lib/cors';
import logger from './logger';
import { swaggerSpec } from './config/swagger';
import { readLimiter, mutationLimiter } from './middleware/rateLimit';
import { requireAdminSubdomain } from './middleware/adminAuth';
import { authMiddleware } from './middleware/auth';
import { prisma } from './lib/prisma';
import {
    scheduleFormDispatcher,
    scheduleSubscriptionExpiry,
    scheduleSessionCleanup,
    scheduleClientStatusSync,
    scheduleCheckInDispatch,
} from './middleware/scheduler';

process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

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
import subscriptionPoliciesRouter from './modules/subscriptionPolicies/index';
import notificationsRouter from './modules/notifications/index';
import paymentsWebhookRouter from './modules/paymentsWebhook/index';
import metricsRouter from './modules/metrics/index';

Sentry.init({
    dsn:              env.SENTRY_DSN,
    environment:      env.NODE_ENV,
    release:          process.env.npm_package_version,
    enabled:          !!env.SENTRY_DSN,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
});

if (env.NODE_ENV !== 'test') {
    scheduleFormDispatcher();
    scheduleSubscriptionExpiry();
    scheduleSessionCleanup();
    scheduleClientStatusSync();
    scheduleCheckInDispatch();
}

const serverStartTime = Date.now();
let totalRequests     = 0;

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
    frameguard: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'"],
            imgSrc:         ["'self'", "data:", "https:"],
            connectSrc:     ["'self'", "https://api.fitforce.io", "https://*.fitforce.io"],
            fontSrc:        ["'self'", "https:", "data:"],
            objectSrc:      ["'none'"],
            mediaSrc:       ["'self'"],
            frameSrc:       ["'self'"],
            frameAncestors: ["'self'", "https://fitforceapp.com", "https://*.fitforceapp.com"],
        },
    },
    hsts: {
        maxAge:            31536000,
        includeSubDomains: true,
        preload:           true,
    },
}));
app.use(compression());
app.use(cors({
    origin: (origin, cb) => {
        if (isAllowedOrigin(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));

// Webhook registered BEFORE express.json() — needs raw body for HMAC verification
app.use('/api/payments/webhook', paymentsWebhookRouter);

// Google Forms Import's paste-page-source fallback: a full Google Forms page
// source (especially the signed-in view, with extra account-switcher chrome)
// routinely exceeds the global 100kb JSON limit below. Scoped bigger limit
// for just this one authenticated route rather than raising the global
// default everywhere — same register-before-the-global-parser pattern the
// webhook above uses, since body-parser no-ops once a body is already parsed.
app.use('/api/forms/import/google-forms-preview', express.json({ limit: '5mb' }));

app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use((_req, _res, next) => { totalRequests++; next(); });

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
app.use('/api/admin',          requireAdminSubdomain, apiLimiter, adminRouter);
app.use('/api/workspaces',     apiLimiter, workspacesRouter);
app.use('/api/invitations',    apiLimiter, invitationsRouter);
app.use('/api/billing',        apiLimiter, billingRouter);
app.use('/api/subscription-policies', apiLimiter, subscriptionPoliciesRouter);
app.use('/api/notifications',  apiLimiter, notificationsRouter);
app.use('/api/metrics',        apiLimiter, metricsRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/health', async (_req: Request, res: Response) => {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        const dbResponseTime = Date.now() - start;
        const mem = process.memoryUsage();

        res.status(200).json({
            status:    'healthy',
            timestamp: new Date().toISOString(),
            uptime:    Math.round(process.uptime()),
            database: {
                status:         'connected',
                responseTimeMs: dbResponseTime,
            },
            memory: {
                heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            },
            version: process.env.npm_package_version ?? '1.0.0',
        });
    } catch {
        res.status(503).json({
            status:    'unhealthy',
            timestamp: new Date().toISOString(),
            database:  { status: 'disconnected' },
        });
    }
});

app.get('/api/server-metrics', authMiddleware, (req: Request, res: Response) => {
    if (!req.user?.isOwner) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const mem = process.memoryUsage();
    res.json({
        uptimeSeconds:  Math.round((Date.now() - serverStartTime) / 1000),
        requestsTotal:  totalRequests,
        memory: {
            heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
    });
});

// Global error handler
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
        logger.error({ err }, 'Unhandled server error');
        Sentry.captureException(err);
    }
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});

export default app;
