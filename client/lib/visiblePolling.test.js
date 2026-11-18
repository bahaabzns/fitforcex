import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startVisiblePolling } from "./visiblePolling";

function makeFakeDocument(hidden = false) {
    const listeners = new Set();
    return {
        hidden,
        addEventListener: (type, fn) => { if (type === "visibilitychange") listeners.add(fn); },
        removeEventListener: (type, fn) => { if (type === "visibilitychange") listeners.delete(fn); },
        listenerCount: () => listeners.size,
        setHidden(value) {
            this.hidden = value;
            listeners.forEach((fn) => fn());
        },
    };
}

describe("startVisiblePolling", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("runs once at start and then every interval while visible", () => {
        const doc = makeFakeDocument();
        const callback = vi.fn();

        startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, doc });
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(3000);
        expect(callback).toHaveBeenCalledTimes(4);
    });

    it("does not run at start when immediate is false", () => {
        const doc = makeFakeDocument();
        const callback = vi.fn();

        startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, immediate: false, doc });
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("stops polling while the page is hidden", () => {
        const doc = makeFakeDocument();
        const callback = vi.fn();
        startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, immediate: false, doc });

        doc.setHidden(true);
        vi.advanceTimersByTime(60_000);

        expect(callback).not.toHaveBeenCalled();
    });

    it("catches up once on return when the interval elapsed, then resumes", () => {
        const doc = makeFakeDocument();
        const callback = vi.fn();
        startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, immediate: false, doc });

        doc.setHidden(true);
        vi.advanceTimersByTime(10_000);
        doc.setHidden(false);
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(2000);
        expect(callback).toHaveBeenCalledTimes(3);
    });

    it("does not run again on return when the last run was recent", () => {
        const doc = makeFakeDocument();
        const callback = vi.fn();
        startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, doc });

        vi.advanceTimersByTime(400);
        doc.setHidden(true);
        doc.setHidden(false);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not start the timer when the page is already hidden", () => {
        const doc = makeFakeDocument(true);
        const callback = vi.fn();

        startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, immediate: false, doc });
        vi.advanceTimersByTime(10_000);

        expect(callback).not.toHaveBeenCalled();
    });

    it("always calls the latest callback", () => {
        const doc = makeFakeDocument();
        const first = vi.fn();
        const second = vi.fn();
        let current = first;
        startVisiblePolling({ getCallback: () => current, intervalMs: 1000, immediate: false, doc });

        current = second;
        vi.advanceTimersByTime(1000);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("stops the timer and removes the listener when the returned stop function is called", () => {
        const doc = makeFakeDocument();
        const callback = vi.fn();
        const stop = startVisiblePolling({ getCallback: () => callback, intervalMs: 1000, immediate: false, doc });

        stop();
        vi.advanceTimersByTime(10_000);

        expect(callback).not.toHaveBeenCalled();
        expect(doc.listenerCount()).toBe(0);
    });
});
