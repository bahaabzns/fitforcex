import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Tests run many requests against the same shared limiter instances (e.g. every
// integration test file hits /login-adjacent routes) from a single in-process
// IP, in one `--runInBand` process — a real 15-minute window would make the
// suite's pass/fail depend on file ordering and how many tests ran before it.
// Rate limiting itself isn't under test, so it's a no-op outside of prod/dev.
const skipInTest = () => env.NODE_ENV === 'test';

export const loginLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            10,
    message:        { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders:  false,
    skip:           skipInTest,
});

export const workspaceDiscoveryLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            10,
    message:        { error: 'Too many attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders:  false,
    skip:           skipInTest,
});

export const readLimiter = rateLimit({
    windowMs:       1 * 60 * 1000,
    max:            500,
    message:        { error: 'Too many requests from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders:  false,
    skip:           skipInTest,
});

export const mutationLimiter = rateLimit({
    windowMs:       1 * 60 * 1000,
    max:            100,
    message:        { error: 'Too many requests from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders:  false,
    skip:           skipInTest,
});

export const uploadLimiter = rateLimit({
    windowMs:       1 * 60 * 1000,
    max:            20,
    message:        { error: 'Too many upload requests from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders:  false,
    skip:           skipInTest,
});
