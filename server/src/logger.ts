import pino from 'pino';
import { env } from './config/env';

const LOG_LEVEL =
    env.NODE_ENV === 'production' ? 'warn'
    : env.NODE_ENV === 'test'     ? 'silent'
    : 'debug';

const logger = pino({
    level: LOG_LEVEL,
    transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});

export default logger;
