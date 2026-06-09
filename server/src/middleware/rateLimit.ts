import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            10,
    message:        { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders:  false,
});

export const readLimiter = rateLimit({
    windowMs:       1 * 60 * 1000,
    max:            500,
    message:        { error: 'Too many requests from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders:  false,
});

export const mutationLimiter = rateLimit({
    windowMs:       1 * 60 * 1000,
    max:            100,
    message:        { error: 'Too many requests from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders:  false,
});

export const uploadLimiter = rateLimit({
    windowMs:       1 * 60 * 1000,
    max:            20,
    message:        { error: 'Too many upload requests from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders:  false,
});
