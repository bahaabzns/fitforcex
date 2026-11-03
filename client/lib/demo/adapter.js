// Axios adapter for the landing-page demo: answers the real client portal's API calls from
// recorded demo data, in memory. No network, no cookies, nothing leaves the browser tab.
import fixtures from "./portal-fixtures.json";

const LATENCY_MS = 120;
const byKey = new Map(fixtures.map((entry) => [`${entry.method} ${entry.path}`, entry.body]));

function respond(config, data, status = 200) {
    return { data, status, statusText: status === 200 ? "OK" : "Not Found", headers: {}, config, request: {} };
}

function pathOf(config) {
    const raw = config.url || "";
    try { return new URL(raw, "http://demo.local").pathname; } catch { return raw; }
}

export async function demoAdapter(config) {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    const method = (config.method || "get").toUpperCase();
    const path = pathOf(config);
    const key = `${method} ${path}`;

    if (byKey.has(key)) return respond(config, byKey.get(key) ?? "");

    // Detail routes: any form request id answers with the recorded one.
    if (method === "GET" && /^\/api\/client-portal\/form-requests\/[^/]+$/.test(path)) {
        const recorded = [...byKey.entries()].find(([k]) => /^GET \/api\/client-portal\/form-requests\/[^/]+$/.test(k));
        if (recorded) return respond(config, recorded[1]);
    }

    // Writes succeed without changing anything for now.
    if (method !== "GET") return respond(config, { ok: true });

    if (process.env.NODE_ENV !== "production") console.warn("[demo] no fixture for", key);
    const error = new Error(`Demo has no data for ${key}`);
    error.response = respond(config, { message: "Not available in the demo" }, 404);
    error.config = config;
    throw error;
}
