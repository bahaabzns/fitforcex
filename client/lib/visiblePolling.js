/**
 * Calls the callback every `intervalMs` while the page is visible; returns a stop function.
 *
 * Why: portal tabs and installed PWAs left in the background used to keep polling the API
 * forever (about 5 requests every 15 seconds per open tab), a large share of production
 * traffic. The timer stops while the page is hidden; when it becomes visible again the
 * callback runs once straight away if the interval elapsed meanwhile, then polling resumes.
 *
 * `getCallback` is read on every tick so callers can hand over the latest closure.
 * `doc` is injectable so this can be tested without a browser.
 */
export function startVisiblePolling({ getCallback, intervalMs, immediate = true, doc = document }) {
    let timer = null;
    let lastRunAt = Date.now();

    const stopTimer = () => {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    };

    const run = () => {
        lastRunAt = Date.now();
        getCallback()();
    };

    const startTimer = () => {
        stopTimer();
        timer = setInterval(run, intervalMs);
    };

    const handleVisibilityChange = () => {
        if (doc.hidden) {
            stopTimer();
            return;
        }
        if (Date.now() - lastRunAt >= intervalMs) run();
        startTimer();
    };

    if (immediate) run();
    if (!doc.hidden) startTimer();
    doc.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
        stopTimer();
        doc.removeEventListener("visibilitychange", handleVisibilityChange);
    };
}
