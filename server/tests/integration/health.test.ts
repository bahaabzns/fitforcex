import { request } from '../helpers/testServer';

describe('GET /api/health', () => {
    test('returns healthy with database status and memory figures split into heap and native', async () => {
        const res = await request.get('/api/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body.database.status).toBe('connected');
        expect(res.body.memory).toEqual({
            heapUsedMB:     expect.any(Number),
            heapTotalMB:    expect.any(Number),
            rssMB:          expect.any(Number),
            externalMB:     expect.any(Number),
            arrayBuffersMB: expect.any(Number),
        });
        expect(res.body.memory.rssMB).toBeGreaterThanOrEqual(res.body.memory.heapUsedMB);
    });
});
