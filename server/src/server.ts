import http from 'http';
import { execSync } from 'child_process';
import path from 'path';
import { env } from './config/env';
import app from './app';
import { initSocket } from './lib/socket';

// Run DB migrations on startup (skip in test environment)
if (env.NODE_ENV !== 'test') {
    try {
        execSync('npm run migrate', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    } catch (err) {
        console.error('Failed to run migrations:', (err as Error).message);
        process.exit(1);
    }
}

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${env.PORT}`);
});

export default httpServer;
