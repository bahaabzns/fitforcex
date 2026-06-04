const express = require('express');
const cors = require('cors');
const path = require('path');

const server = express();

server.set('trust proxy', 1); // trust first hop (Nginx reverse proxy)

const PORT = process.env.PORT || 4000;

const pool = require('./db');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const cookieParser = require('cookie-parser');
const { execSync } = require('child_process');
const { readLimiter, mutationLimiter } = require('./middleware/rateLimit');

// GETs get a generous cap; POST/PUT/PATCH/DELETE get the tighter mutation cap
const apiLimiter = (req, res, next) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    return isMutation ? mutationLimiter(req, res, next) : readLimiter(req, res, next);
};
const helmet = require('helmet');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

const logger = require('./logger');
const pinoHttp = require('pino-http');
const Sentry = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    enabled: !!process.env.SENTRY_DSN,
});

// Run DB migrations on startup (skip in test environment — schema is managed separately)
if (process.env.NODE_ENV !== 'test') {
    try {
        execSync('npm run migrate', { cwd: __dirname, stdio: 'inherit' });
    } catch (err) {
        console.error('Failed to run migrations:', err.message);
        process.exit(1);
    }
}

// Request logging — add before routes
server.use(pinoHttp({ logger }));



server.use(helmet());

server.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));

// Webhook must be registered BEFORE express.json() — it needs the raw body for HMAC verification
server.use('/api/payments/webhook', require('./routes/payments-webhook'));

server.use(express.json());
server.use(cookieParser());

// Routes
server.use('/api/auth', authRouter);
server.use('/api/dashboard', dashboardRouter);
server.use('/api/clients',        apiLimiter, require('./routes/clients'));
server.use('/api/nutrition',      apiLimiter, require('./routes/nutrition'));
server.use('/api/training',       apiLimiter, require('./routes/training'));
server.use('/api/client-portal',  apiLimiter, require('./routes/clientPortal'));
server.use('/api/forms',          apiLimiter, require('./routes/forms'));
server.use('/api/packages',       apiLimiter, require('./routes/packages'));
server.use('/api/payment-methods',apiLimiter, require('./routes/payment-methods'));
server.use('/api/transactions',   apiLimiter, require('./routes/transactions'));
server.use('/api/plans',                         require('./routes/plans'));
server.use('/api/admin',          apiLimiter, require('./routes/admin'));
server.use('/api/workspaces',     apiLimiter, require('./routes/workspaces'));
server.use('/api/invitations',    apiLimiter, require('./routes/invitations'));
const { router: billingRouter } = require('./routes/billing');
server.use('/api/billing',        apiLimiter, billingRouter);

server.get('/api/health', (req, res) => {
    res.status(200).json({message: 'All is good!'})
});


// global error handler
server.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
        req.log.error({ err }, 'Unhandled server error');
        Sentry.captureException(err);
    }
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});

if (require.main === module) {
    server.listen(PORT, '127.0.0.1', () => {
        console.log('Server running on http://127.0.0.1:' + PORT);
    });
}

module.exports = server;
