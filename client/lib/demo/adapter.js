// Axios adapter for the landing-page demo: answers the real client portal's API calls from
// recorded demo data, in memory. No network, no cookies, nothing leaves the browser tab.
// State (eaten meals, swaps, messages, forms, workouts) lives in this module, so reloading the
// iframe is the "start over" button.
import fixtures from "./portal-fixtures.json";
import { DEMO_MESSAGES, DEMO_REPLY, localizeDeep, FOOD_CATALOG, FOOD_GROUP_LABELS } from "./content";

const LATENCY_MS = 120;
const COACH_REPLY_DELAY_MS = 2200;
const JUNK_EXERCISES = new Set(["fdas", "SL EXTENSIONS", "SA Cable Push Down", "Frontal plane Lat Pulldown", "Cable wrist flexions"]);
const TRAINING_CHECKIN = "Weekly Training Check-in";

const WELCOME = { en: "Welcome back! Your plans and progress are all here.", ar: "أهلًا بيكي! خططك وتقدمك كلهم هنا." };
const byKey = new Map(fixtures.map((entry) => [`${entry.method} ${entry.path}`, entry.body]));
const clone = (value) => JSON.parse(JSON.stringify(value));
const isArabic = () => typeof document !== "undefined" && document.documentElement.lang === "ar";
const text = (en, ar) => (isArabic() ? ar : en);

// Tells the landing page which demo tasks the visitor just completed.
function emit(event) {
    try { window.parent.postMessage({ source: "ff-demo", event }, window.location.origin); } catch { /* not framed */ }
}

function respond(config, data, status = 200) {
    return { data, status, statusText: status === 200 ? "OK" : "Not Found", headers: {}, config, request: {} };
}

function pathOf(config) {
    const raw = config.url || "";
    try { return new URL(raw, "http://demo.local").pathname; } catch { return raw; }
}

function bodyOf(config) {
    if (!config.data) return {};
    if (typeof config.data === "string") { try { return JSON.parse(config.data); } catch { return {}; } }
    return config.data;
}

// ── Lazy, per-tab state ───────────────────────────────────────────────────────
const state = {
    plan: null,
    swapOrigins: {},
    diary: null,
    messages: null,
    formSubmitted: false,
    workoutLogged: false,
};

function fixture(path) { return clone(byKey.get(`GET ${path}`)); }

function getPlan() {
    if (!state.plan) state.plan = localizeDeep(fixture("/api/client-portal/active-plan"));
    return state.plan;
}

function getDiary() {
    if (!state.diary) state.diary = localizeDeep(fixture("/api/client-portal/food-diary/today"));
    return state.diary;
}

function getMessages() {
    if (!state.messages) {
        const now = Date.now();
        state.messages = DEMO_MESSAGES[isArabic() ? "ar" : "en"].map((message, index, all) => ({
            id: `demo-m${index + 1}`,
            sender_type: message.from,
            sender_id: message.from === "team" ? "demo-coach" : "demo-client",
            body: message.body,
            type: "text",
            attachment_url: null, attachment_name: null, attachment_size: null, attachment_mime: null, attachment_duration: null,
            edited_at: null, deleted_at: null,
            read_by_team_at: null,
            read_by_client_at: new Date(now - (all.length - index) * 3_600_000).toISOString(),
            created_at: new Date(now - (all.length - index) * 3_600_000).toISOString(),
            reply_to_id: null, reply_to: null,
        }));
    }
    return state.messages;
}

function findItem(plan, itemId) {
    for (const cycle of plan.cycles ?? []) for (const meal of cycle.meals ?? []) {
        const item = (meal.items ?? []).find((candidate) => candidate.id === itemId);
        if (item) return item;
    }
    return null;
}

const kcalOf = (item) => (Number(item.amount) / Number(item.serving_size || 100)) * Number(item.calories_per_serving);

function groupOf(item) {
    const name = `${item.name} ${item.name_en ?? ""}`.toLowerCase();
    return FOOD_CATALOG.find((food) => name.includes(food.match))?.group ?? "protein";
}

function swapSearch(itemId, query) {
    const item = findItem(getPlan(), itemId);
    if (!item) return { currentFood: null, alternatives: [] };
    const group = groupOf(item);
    const sourceCalories = kcalOf(item);
    const needle = (query || "").trim().toLowerCase();
    const alternatives = FOOD_CATALOG
        .filter((food) => food.group === group && food.id !== item.food_item_id && !item.name.toLowerCase().includes(food.match))
        .filter((food) => !needle || food.en.toLowerCase().includes(needle) || food.ar.includes(needle))
        .map((food) => {
            const amount = Math.round(sourceCalories / (food.kcal / 100));
            const ratio = amount / 100;
            const round1 = (value) => Math.round(value * 10) / 10;
            return {
                foodItemId: food.id, name: food.en, nameAr: food.ar, servingUnit: "g",
                foodCategory: FOOD_GROUP_LABELS[group].en, foodCategoryAr: FOOD_GROUP_LABELS[group].ar,
                calculatedAmount: amount, isCalorieMatched: true,
                calories: round1(ratio * food.kcal), protein: round1(ratio * food.protein), carbs: round1(ratio * food.carbs), fat: round1(ratio * food.fat),
            };
        });
    return { currentFood: { foodItemId: item.food_item_id, name: item.name, nameAr: item.name_ar, amount: Number(item.amount) }, alternatives };
}

function swapItem(itemId, alternativeId) {
    const item = findItem(getPlan(), itemId);
    const food = FOOD_CATALOG.find((candidate) => candidate.id === alternativeId);
    if (!item || !food) return { ok: false };
    if (!state.swapOrigins[itemId]) state.swapOrigins[itemId] = clone(item);
    const original = state.swapOrigins[itemId];
    Object.assign(item, {
        food_item_id: food.id, name: food.en, name_ar: food.ar, serving_unit: "g", serving_size: "100",
        amount: String(Math.round(kcalOf(original) / (food.kcal / 100))),
        calories_per_serving: String(food.kcal), protein_per_serving: String(food.protein), carbs_per_serving: String(food.carbs), fats_per_serving: String(food.fat),
        food_category: FOOD_GROUP_LABELS[food.group].en,
        is_swapped: true, swapped_at: new Date().toISOString(),
        original_food_item_id: original.food_item_id, original_food_name: original.name, original_food_name_ar: original.name_ar,
    });
    emit("food_swapped");
    return clone(item);
}

function resetSwap(itemId) {
    const item = findItem(getPlan(), itemId);
    const original = state.swapOrigins[itemId];
    if (item && original) { Object.assign(item, original); delete state.swapOrigins[itemId]; }
    return { ok: true };
}

function recomputeDiary(diary) {
    const totals = diary.items.reduce((sum, entry) => {
        const ratio = Number(entry.amount_eaten || 0) / Number(entry.serving_size || 100);
        return {
            calories: sum.calories + ratio * Number(entry.calories_per_serving),
            protein: sum.protein + ratio * Number(entry.protein_per_serving),
            carbs: sum.carbs + ratio * Number(entry.carbs_per_serving),
            fats: sum.fats + ratio * Number(entry.fats_per_serving),
        };
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
    diary.total_calories = Math.round(totals.calories);
    diary.total_protein = Math.round(totals.protein);
    diary.total_carbs = Math.round(totals.carbs);
    diary.total_fats = Math.round(totals.fats);
    diary.adherence = diary.goal_calories ? Math.min(100, Math.round((totals.calories / diary.goal_calories) * 100)) : 0;
}

function patchDiary(body) {
    const diary = getDiary();
    const entry = diary.items.find((candidate) => candidate.meal_item_id === body.meal_item_id);
    if (entry) {
        entry.amount_eaten = Number(body.amount_eaten) || 0;
        recomputeDiary(diary);
        if (entry.amount_eaten > 0) emit("meal_checked");
    }
    return clone(diary);
}

function trainingPlan() {
    const plan = localizeDeep(fixture("/api/client-portal/active-training-plan"));
    plan.days = (plan.days ?? []).map((day) => ({ ...day, exercises: (day.exercises ?? []).filter((exercise) => !JUNK_EXERCISES.has(exercise.name)) }));
    return plan;
}

function saveWorkout(body) {
    const sets = (body.exercises ?? []).flatMap((exercise) => exercise.sets ?? []);
    // A set counts once it's ticked off, or once both weight and reps have been typed in.
    const done = sets.filter((set) => set.completed === true || (set.weight && set.reps));
    if (done.length && !state.workoutLogged) { state.workoutLogged = true; emit("workout_logged"); }
    if (!body.completed) return { ok: true };
    const start = new Date(body.started_at).getTime();
    return {
        ok: true,
        duration_seconds: Math.max(60, Math.round((Date.now() - start) / 1000)),
        total_volume: Math.round(done.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0)),
        total_sets: done.length,
    };
}

function formRequests() {
    const list = fixture("/api/client-portal/form-requests").filter((request) => request.form_title_en === TRAINING_CHECKIN);
    return localizeDeep(list.map((request) => (state.formSubmitted && request.status === "pending" ? { ...request, status: "submitted", submitted_at: new Date().toISOString() } : request)));
}

function formDetail(requestId) {
    const template = clone([...byKey.entries()].find(([key]) => /^GET \/api\/client-portal\/form-requests\/[^/]+$/.test(key))[1]);
    const request = formRequests().find((candidate) => candidate.id === requestId);
    if (request?.status === "pending") return { ...template, id: requestId, status: "pending", requested_at: request.requested_at, submitted_at: null, responses: [] };
    return { ...template, id: requestId };
}

function sendMessage(body) {
    const messages = getMessages();
    const replyTarget = body.replyToId ? messages.find((message) => message.id === body.replyToId) : null;
    const message = {
        id: `demo-c${messages.length + 1}`, sender_type: "client", sender_id: "demo-client", body: body.body, type: "text",
        attachment_url: null, attachment_name: null, attachment_size: null, attachment_mime: null, attachment_duration: null,
        edited_at: null, deleted_at: null, read_by_team_at: null,
        read_by_client_at: new Date().toISOString(), created_at: new Date().toISOString(),
        reply_to_id: body.replyToId ?? null,
        reply_to: replyTarget ? { id: replyTarget.id, body: replyTarget.body, sender_type: replyTarget.sender_type, type: "text", deleted_at: null } : null,
    };
    messages.push(message);
    emit("message_sent");
    setTimeout(() => {
        const now = new Date().toISOString();
        messages.push({ ...message, id: `demo-t${messages.length + 1}`, sender_type: "team", sender_id: "demo-coach", body: DEMO_REPLY[isArabic() ? "ar" : "en"], created_at: now, read_by_client_at: now, reply_to_id: null, reply_to: null });
    }, COACH_REPLY_DELAY_MS);
    return clone(message);
}

// ── Router ────────────────────────────────────────────────────────────────────
function route(method, path, config) {
    const body = bodyOf(config);
    const params = config.params || {};

    if (method === "GET") {
        if (path === "/api/client-portal/active-plan") return clone(getPlan());
        if (path === "/api/client-portal/food-diary/today") return clone(getDiary());
        if (path === "/api/client-portal/active-training-plan") return trainingPlan();
        if (path === "/api/client-portal/prompts/active") return "";
        if (path === "/api/client-portal/me" || path === "/api/client-portal/branding") {
            const data = fixture(path);
            const welcome = WELCOME[isArabic() ? "ar" : "en"];
            if (data.branding) data.branding.welcomeMessage = welcome; else data.welcomeMessage = welcome;
            return data;
        }
        if (path === "/api/client-portal/messages") {
            const data = fixture("/api/client-portal/messages");
            return { ...data, coachName: text("Your coach", "مدربك"), messages: clone(getMessages()) };
        }
        if (path === "/api/client-portal/form-requests") return formRequests();
        if (path === "/api/client-portal/action-items") {
            return localizeDeep(fixture("/api/client-portal/action-items")).filter((item) => !state.formSubmitted && item.kind === "pending_form" && item.title_en === TRAINING_CHECKIN);
        }
        if (path === "/api/client-portal/notifications") return localizeDeep(fixture(path)).slice(0, state.formSubmitted ? 0 : 1);
        if (path === "/api/client-portal/notifications/unread-count") return { count: state.formSubmitted ? 0 : 1 };
        let match = path.match(/^\/api\/client-portal\/form-requests\/([^/]+)$/);
        if (match) return formDetail(match[1]);
        match = path.match(/^\/api\/client-portal\/meal-items\/([^/]+)\/swap-search$/);
        if (match) return swapSearch(match[1], params.query);
        if (path === "/api/client-portal/workout-logs/draft") return "";
        if (path.startsWith("/api/client-portal/workout-logs/") && !byKey.has(`GET ${path}`)) {
            const logPath = [...byKey.keys()].find((key) => /^GET \/api\/client-portal\/workout-logs\/[a-z0-9]{20,}$/.test(key));
            if (logPath) return clone(byKey.get(logPath));
        }
        return undefined;
    }

    let match = path.match(/^\/api\/client-portal\/meal-items\/([^/]+)\/swap$/);
    if (match) return swapItem(match[1], body.alternativeFoodId);
    match = path.match(/^\/api\/client-portal\/meal-items\/([^/]+)\/swap\/reset$/);
    if (match) return resetSwap(match[1]);
    if (path === "/api/client-portal/food-diary/today" && method === "PATCH") return patchDiary(body);
    if (path === "/api/client-portal/messages" && method === "POST") return sendMessage(body);
    if (/^\/api\/client-portal\/workout-logs\/[^/]+$/.test(path) && method === "PUT") return saveWorkout(body);
    if (/\/form-requests\/[^/]+\/submit$/.test(path) && method === "POST") { state.formSubmitted = true; emit("form_submitted"); return { ok: true }; }
    return { ok: true };
}

export async function demoAdapter(config) {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    const method = (config.method || "get").toUpperCase();
    const path = pathOf(config);

    const dynamic = route(method, path, config);
    if (dynamic !== undefined) return respond(config, dynamic);
    if (method === "GET" && byKey.has(`GET ${path}`)) return respond(config, byKey.get(`GET ${path}`) ?? "");

    if (process.env.NODE_ENV !== "production") console.warn("[demo] no fixture for", `${method} ${path}`);
    const error = new Error(`Demo has no data for ${method} ${path}`);
    error.response = respond(config, { message: "Not available in the demo" }, 404);
    error.config = config;
    throw error;
}
