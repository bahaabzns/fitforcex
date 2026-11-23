import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { RequestSlots, gateRequests } from '../../src/middleware/heavyRequestGate';

function fakeRequest(query: Record<string, string> = {}): Request {
    return { query } as unknown as Request;
}
function fakeResponse(): Response & EventEmitter {
    return new EventEmitter() as unknown as Response & EventEmitter;
}

/** Sends a request through the gate and reports whether the route handler (next) has been reached. */
function send(gate: ReturnType<typeof gateRequests>, query: Record<string, string> = {}) {
    const res = fakeResponse();
    const next = jest.fn();
    gate(fakeRequest(query), res, next);
    return { res, next };
}

describe('gateRequests', () => {
    it('lets requests through up to the limit and queues the rest', () => {
        const gate = gateRequests(new RequestSlots(2));

        const first  = send(gate);
        const second = send(gate);
        const third  = send(gate);

        expect(first.next).toHaveBeenCalledTimes(1);
        expect(second.next).toHaveBeenCalledTimes(1);
        expect(third.next).not.toHaveBeenCalled();
    });

    it('starts the next queued request, in arrival order, when a response finishes', () => {
        const gate = gateRequests(new RequestSlots(1));
        const first  = send(gate);
        const second = send(gate);
        const third  = send(gate);

        first.res.emit('finish');
        expect(second.next).toHaveBeenCalledTimes(1);
        expect(third.next).not.toHaveBeenCalled();

        second.res.emit('finish');
        expect(third.next).toHaveBeenCalledTimes(1);
    });

    it('also frees the slot when the client disconnects mid-response (close without finish)', () => {
        const gate = gateRequests(new RequestSlots(1));
        const first  = send(gate);
        const second = send(gate);

        first.res.emit('close');

        expect(second.next).toHaveBeenCalledTimes(1);
    });

    it('frees the slot only once when both finish and close fire', () => {
        const slots = new RequestSlots(1);
        const gate  = gateRequests(slots);
        const first = send(gate);
        send(gate);
        send(gate);

        first.res.emit('finish');
        first.res.emit('close');

        expect(slots.activeCount).toBe(1);   // the second request holds the slot; the third is still waiting
        expect(slots.waitingCount).toBe(1);
    });

    it('drops a queued request whose client gave up before it started', () => {
        const slots = new RequestSlots(1);
        const gate  = gateRequests(slots);
        const first  = send(gate);
        const second = send(gate);
        const third  = send(gate);

        second.res.emit('close');            // abandoned while waiting
        first.res.emit('finish');

        expect(second.next).not.toHaveBeenCalled();
        expect(third.next).toHaveBeenCalledTimes(1);
        expect(slots.waitingCount).toBe(0);
    });

    it('bypasses the gate, without using a slot, when appliesTo says no', () => {
        const slots = new RequestSlots(1);
        const gate  = gateRequests(slots, (req) => Number(req.query.limit) > 200);

        const small = send(gate, { limit: '20' });
        const large = send(gate, { limit: '10000' });
        const smallAgain = send(gate, { limit: '50' });

        expect(small.next).toHaveBeenCalledTimes(1);
        expect(large.next).toHaveBeenCalledTimes(1);
        expect(smallAgain.next).toHaveBeenCalledTimes(1);
        expect(slots.activeCount).toBe(1);   // only the large one holds a slot
    });

    it('shares one pool between several gates', () => {
        const slots = new RequestSlots(1);
        const gateA = gateRequests(slots);
        const gateB = gateRequests(slots);

        const a = send(gateA);
        const b = send(gateB);

        expect(a.next).toHaveBeenCalledTimes(1);
        expect(b.next).not.toHaveBeenCalled();

        a.res.emit('finish');
        expect(b.next).toHaveBeenCalledTimes(1);
    });

    it('keeps the slot count consistent over many requests', () => {
        const slots = new RequestSlots(2);
        const gate  = gateRequests(slots);
        const sent = Array.from({ length: 50 }, () => send(gate));

        for (const request of sent) {
            if (request.next.mock.calls.length > 0) request.res.emit('finish');
        }
        // Finishing the started ones starts the waiting ones in turn; drain until everything has run.
        let guard = 0;
        while (sent.some((r) => r.next.mock.calls.length === 0) && guard++ < 100) {
            sent.filter((r) => r.next.mock.calls.length > 0).forEach((r) => r.res.emit('finish'));
        }

        expect(sent.every((r) => r.next.mock.calls.length === 1)).toBe(true);
        expect(slots.activeCount).toBeLessThanOrEqual(2);
        sent.forEach((r) => r.res.emit('finish'));
        expect(slots.activeCount).toBe(0);
        expect(slots.waitingCount).toBe(0);
    });
});
