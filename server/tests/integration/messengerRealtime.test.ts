import http from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { initSocket } from '../../src/lib/socket';
import app from '../../src/app';
import { testPrisma } from '../helpers/testDb';

// The messenger page relies on a real `new_message` socket push, not just the
// REST endpoints, to feel instant instead of waiting for the next poll tick
// (see messenger/page.js's socket effect). testServer.ts's shared io is bound
// to a non-listening http server (fine for getIo().emit() not to throw), which
// a real socket.io-client can't connect to — so this file spins up its own
// listening server and rebinds io to it, scoped to this file only (Jest gives
// every test file its own module registry, so this doesn't affect other files
// that import socket.ts via testServer.ts).
describe('Messenger — real-time new_message delivery', () => {
    let httpServer: http.Server;
    let port: number;

    beforeAll(async () => {
        httpServer = http.createServer(app);
        initSocket(httpServer);
        await new Promise<void>((resolve) => httpServer.listen(0, resolve));
        port = (httpServer.address() as AddressInfo).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    async function connectAuthedSocket(cookie: string): Promise<ClientSocket> {
        const socket = ioClient(`http://localhost:${port}`, {
            extraHeaders: { Cookie: cookie },
            transports: ['websocket'],
            forceNew: true,
        });
        await new Promise<void>((resolve, reject) => {
            socket.on('connect', () => resolve());
            socket.on('connect_error', reject);
        });
        return socket;
    }

    test('sending a message pushes new_message to the sender\'s own workspace room', async () => {
        const user = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Realtime', lname: 'Client', email: `realtime-${createId()}@test.com`,
                workspace_id: workspace.id,
            },
        });
        const threadRes = await request.post('/api/messenger/threads').set('Cookie', cookie).send({ clientId: client.id });
        const threadId = threadRes.body.id;

        const socket = await connectAuthedSocket(cookie);
        try {
            const eventPromise = new Promise<{ threadId: string; message: { body: string } }>((resolve) => {
                socket.on('new_message', resolve);
            });

            const sendRes = await request
                .post(`/api/messenger/threads/${threadId}/messages`)
                .set('Cookie', cookie)
                .send({ body: 'hello realtime' });
            expect(sendRes.status).toBe(201);

            const payload = await eventPromise;
            expect(payload.threadId).toBe(threadId);
            expect(payload.message.body).toBe('hello realtime');
        } finally {
            socket.disconnect();
        }
    });

    test('a workspace member not in the thread\'s workspace never receives the event', async () => {
        const user = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');
        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Realtime', lname: 'Client2', email: `realtime2-${createId()}@test.com`,
                workspace_id: workspace.id,
            },
        });
        const threadRes = await request.post('/api/messenger/threads').set('Cookie', cookie).send({ clientId: client.id });
        const threadId = threadRes.body.id;

        const otherUser = await createTestUser();
        const otherWorkspace = await createTestWorkspace(otherUser.id);
        const otherCookie = await makeAuthCookie(otherUser.id, otherWorkspace.id, 'owner');

        const outsiderSocket = await connectAuthedSocket(otherCookie);
        try {
            let received = false;
            outsiderSocket.on('new_message', () => { received = true; });

            const sendRes = await request
                .post(`/api/messenger/threads/${threadId}/messages`)
                .set('Cookie', cookie)
                .send({ body: 'private to my workspace' });
            expect(sendRes.status).toBe(201);

            // Give any (incorrect) cross-workspace delivery a moment to arrive.
            await new Promise((resolve) => setTimeout(resolve, 300));
            expect(received).toBe(false);
        } finally {
            outsiderSocket.disconnect();
        }
    });
});
