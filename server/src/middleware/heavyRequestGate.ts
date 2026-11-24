import { Request, Response, NextFunction, RequestHandler } from 'express';

// The big list endpoints (every client, every thread, the whole plans queue, every transaction)
// each build a multi-megabyte response. On one CPU core, running several at once adds no
// throughput, but every request holds its rows, its JSON string and its gzip buffers in memory at
// the same time: six together took the API from 440 MB to over 900 MB in a 10,000-client test,
// enough to hit pm2's memory limit and restart. Letting a couple run at a time and queueing the
// rest keeps the peak small for the same total time.
export const HEAVY_REQUESTS_MAX_CONCURRENT = 2;

/** A pool of slots shared by every gated route, so the heavy endpoints are limited together. */
export class RequestSlots {
    private active = 0;
    private readonly waiting: Array<() => void> = [];

    constructor(private readonly maxConcurrent: number) {}

    get activeCount(): number { return this.active; }
    get waitingCount(): number { return this.waiting.length; }

    /** Runs `start` now if a slot is free, otherwise when one is released. Returns a function that cancels a queued start. */
    acquire(start: () => void): () => void {
        if (this.active < this.maxConcurrent) {
            this.active++;
            start();
            return () => undefined;
        }
        const queued = (): void => { this.active++; start(); };
        this.waiting.push(queued);
        return () => {
            const index = this.waiting.indexOf(queued);
            if (index !== -1) this.waiting.splice(index, 1);
        };
    }

    release(): void {
        this.active--;
        const startNext = this.waiting.shift();
        if (startNext) startNext();
    }
}

/** Express middleware that holds a slot from the start of the request until the response finishes or the client leaves. */
export function gateRequests(slots: RequestSlots, appliesTo?: (req: Request) => boolean): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (appliesTo && !appliesTo(req)) { next(); return; }

        let released = false;
        const releaseOnce = (): void => {
            if (released) return;
            released = true;
            slots.release();
        };

        const cancelQueued = slots.acquire(() => {
            res.removeListener('close', cancelQueuedOnClose);
            res.once('finish', releaseOnce);
            res.once('close', releaseOnce);   // also fires when the client disconnects mid-response
            next();
        });

        // If the caller gives up while still waiting, drop it so nobody builds a response for a closed socket.
        function cancelQueuedOnClose(): void { cancelQueued(); }
        res.once('close', cancelQueuedOnClose);
    };
}

export const heavyRequestSlots = new RequestSlots(HEAVY_REQUESTS_MAX_CONCURRENT);

export const heavyListGate: RequestHandler = gateRequests(heavyRequestSlots);

/** The plans queue is only heavy as one full list; a single page (?page=) is small and must not wait behind the big requests. */
export const heavyQueueListGate: RequestHandler = gateRequests(heavyRequestSlots, (req) => req.query.page === undefined);

/** The clients list is only heavy when the page asks for a lot of rows (the web app loads 10,000). */
export const heavyClientListGate: RequestHandler = gateRequests(
    heavyRequestSlots,
    (req) => (parseInt(req.query.limit as string, 10) || 20) > 200,
);
