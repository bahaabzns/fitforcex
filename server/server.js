const express = require('express');
const cors = require('cors');
const path = require('path');

const server = express();

const PORT = process.env.PORT || 4000;

const pool = require('./db');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const cookieParser = require('cookie-parser');
const { execSync } = require('child_process');
const { mutationLimiter, uploadLimiter } = require('./middleware/rateLimit');
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

server.use(express.json());
server.use(cookieParser());

// Routes
server.use('/api/auth', authRouter);
server.use('/api/dashboard', dashboardRouter);
server.use('/api/clients',        mutationLimiter, require('./routes/clients'));
server.use('/api/nutrition',      mutationLimiter, require('./routes/nutrition'));
server.use('/api/training',       mutationLimiter, uploadLimiter, require('./routes/training'));
server.use('/api/client-portal',  mutationLimiter, require('./routes/clientPortal'));
server.use('/api/forms',          mutationLimiter, uploadLimiter, require('./routes/forms'));
server.use('/api/packages',       mutationLimiter, require('./routes/packages'));
server.use('/api/payment-methods',mutationLimiter, require('./routes/payment-methods'));
server.use('/api/transactions',   mutationLimiter, uploadLimiter, require('./routes/transactions'));
server.use('/api/admin',          mutationLimiter, require('./routes/admin'));
server.use('/api/workspaces',     mutationLimiter, require('./routes/workspaces'));
server.use('/api/invitations',    mutationLimiter, require('./routes/invitations'));

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
    server.listen(PORT, () => {
        console.log('Server running on http://localhost:' + PORT);
    });
}

module.exports = server;
