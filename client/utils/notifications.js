/**
 * Shared notification taxonomy and priority helpers — used by NotificationBell.js
 * (coach) and the client-portal notifications page so both surfaces agree on the
 * same categories and the same priority treatment.
 *
 * Categories are deliberately few (see NOTIFICATIONS_ENHANCEMENT_PLAN.md Phase 3):
 * Messages / Coaching / Billing & Subscription. `importance` reuses the three
 * values the backend already writes (info | actionable | alert) — no new value.
 */

export const NOTIFICATION_CATEGORIES = {
    messages: {
        types: ['message.received'],
    },
    coaching: {
        types: ['plan.assigned', 'checkin.submitted', 'checkin.assigned', 'checkin.reviewed', 'client.created'],
    },
    billing: {
        types: [
            'billing.payment_received', 'billing.payment_failed',
            'subscription.expired', 'subscription.frozen', 'subscription.reactivated',
        ],
    },
};

/** @param {string} type @returns {'messages'|'coaching'|'billing'|null} */
export function getNotificationCategory(type) {
    for (const [category, { types }] of Object.entries(NOTIFICATION_CATEGORIES)) {
        if (types.includes(type)) return category;
    }
    return null;
}

// Order drives the filter-chip row on both surfaces.
export const FILTER_KEYS = ['all', 'unread', 'messages', 'coaching', 'billing'];

/**
 * Client-side filter over an already-fetched page — no backend query needed at
 * current list sizes (30-100 rows max). 'unread' filters the loaded page rather
 * than re-fetching with ?unread=true, since a second round trip buys no real
 * accuracy at this scale.
 * @param {Array<object>} items @param {string} filter @returns {Array<object>}
 */
export function filterItems(items, filter) {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter(n => !n.read_at);
    return items.filter(n => getNotificationCategory(n.type) === filter);
}

const IMPORTANCE_WEIGHT = { alert: 2, actionable: 1, info: 0 };

/**
 * Stable re-sort of an already-fetched page: unread first (highest importance
 * first within that group), then read items in pure recency order underneath.
 * Never re-fetches or reorders across pages — purely a render-time transform.
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function sortByPriority(items) {
    const unread = items.filter(n => !n.read_at);
    const read   = items.filter(n => n.read_at);

    unread.sort((a, b) => {
        const weightDiff = (IMPORTANCE_WEIGHT[b.importance] ?? 0) - (IMPORTANCE_WEIGHT[a.importance] ?? 0);
        if (weightDiff !== 0) return weightDiff;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    read.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return [...unread, ...read];
}

/**
 * Tailwind classes for the start-side priority accent border. `alert` stays
 * visible even after read (a payment failure shouldn't fade into the read pile
 * the way an `info` item can); `actionable` only accents while unread.
 * @param {{ importance?: string, read_at?: string|null }} notification
 * @returns {string}
 */
export function priorityAccentClass(notification) {
    if (notification.importance === 'alert') return 'border-s-2 border-destructive';
    if (notification.importance === 'actionable' && !notification.read_at) return 'border-s-2 border-primary';
    return 'border-s-2 border-transparent';
}

/**
 * Collapses repetitive notifications into groups for a "+N more" affordance.
 * Only two patterns group (see NOTIFICATIONS_ENHANCEMENT_PLAN.md Phase 5):
 *  - message.received sharing the same thread (entity_id) — 2 or more.
 *  - checkin.submitted on the same calendar day — 3 or more.
 * Everything else (billing, subscription, client.created, single occurrences)
 * renders as its own node. Grouping never reorders the list — a group's
 * position is wherever its first (highest-priority-sorted) member already sits
 * in the input, so it composes cleanly with sortByPriority.
 * @param {Array<object>} items - already sorted, e.g. via sortByPriority
 * @returns {Array<{kind:'single', item:object} | {kind:'group', key:string, items:object[]}>}
 */
export function groupNotifications(items) {
    const threadGroups = new Map();
    const checkinDayGroups = new Map();

    for (const n of items) {
        if (n.type === 'message.received' && n.entity_type === 'thread' && n.entity_id) {
            if (!threadGroups.has(n.entity_id)) threadGroups.set(n.entity_id, []);
            threadGroups.get(n.entity_id).push(n);
        } else if (n.type === 'checkin.submitted') {
            const day = new Date(n.created_at).toDateString();
            if (!checkinDayGroups.has(day)) checkinDayGroups.set(day, []);
            checkinDayGroups.get(day).push(n);
        }
    }

    const consumed = new Set();
    const result = [];

    for (const n of items) {
        if (consumed.has(n.id)) continue;

        if (n.type === 'message.received' && n.entity_type === 'thread' && n.entity_id) {
            const group = threadGroups.get(n.entity_id);
            if (group.length >= 2) {
                group.forEach(g => consumed.add(g.id));
                result.push({ kind: 'group', key: `thread:${n.entity_id}`, items: group });
                continue;
            }
        } else if (n.type === 'checkin.submitted') {
            const day = new Date(n.created_at).toDateString();
            const group = checkinDayGroups.get(day);
            if (group.length >= 3) {
                group.forEach(g => consumed.add(g.id));
                result.push({ kind: 'group', key: `checkins:${day}`, items: group });
                continue;
            }
        }

        consumed.add(n.id);
        result.push({ kind: 'single', item: n });
    }

    return result;
}
