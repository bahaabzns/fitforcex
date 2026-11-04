// Shared rules for the admin Follow-ups page: how long a coach has been around, what their status
// is called, and which coaches to message first.

export const REPORT_TIME_ZONE = 'Africa/Cairo';
const DAY_MS = 24 * 60 * 60 * 1000;

// Same buckets feed the "when coaches joined" chart and the days-since-signup filter.
export const AGE_BUCKETS = [
    { key: '0-1',   label: '0–1 days',   min: 0,  max: 1 },
    { key: '2-3',   label: '2–3 days',   min: 2,  max: 3 },
    { key: '4-7',   label: '4–7 days',   min: 4,  max: 7 },
    { key: '8-14',  label: '8–14 days',  min: 8,  max: 14 },
    { key: '15-30', label: '15–30 days', min: 15, max: 30 },
    { key: '31-60', label: '31–60 days', min: 31, max: 60 },
    { key: '60+',   label: '60+ days',   min: 61, max: Infinity },
];

// Entity colours stay the same on every chart: free = blue, subscribed = aqua, expired = orange.
export const STATUS_META = {
    free:       { label: 'Free',       color: 'var(--viz-s1)', chip: 'bg-blue-500/15 text-blue-700 border-blue-300' },
    subscribed: { label: 'Subscribed', color: 'var(--viz-s3)', chip: 'bg-green-500/15 text-green-700 border-green-300' },
    expired:    { label: 'Expired',    color: 'var(--viz-s2)', chip: 'bg-orange-500/15 text-orange-700 border-orange-300' },
};
export const STATUS_ORDER = ['free', 'subscribed', 'expired'];

export function ageBucketOf(daysSinceSignup) {
    return AGE_BUCKETS.find(bucket => daysSinceSignup >= bucket.min && daysSinceSignup <= bucket.max) ?? AGE_BUCKETS[AGE_BUCKETS.length - 1];
}

export function whatsAppLink(whatsappNumber) {
    return `https://wa.me/${whatsappNumber}`;
}

// Calendar date (YYYY-MM-DD) in Cairo — the day the admin means by "today".
export function cairoDate(offsetDays = 0) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE }).format(new Date(Date.now() + offsetDays * DAY_MS));
}

export function daysBetweenDates(fromDate, toDate) {
    return Math.round((new Date(`${toDate}T00:00:00Z`) - new Date(`${fromDate}T00:00:00Z`)) / DAY_MS);
}

export function addDaysToDate(date, days) {
    return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Who to act on first: coaches with a manual transfer waiting for you to confirm (they already
// decided to pay; longest wait first), then reminders that are due (most overdue first), then coaches
// nobody has messaged yet (newest sign-ups first, while they still remember us), then everyone else
// with the longest silence first.
export function sortForToday(coaches) {
    const rank = coach => {
        if (coach.pendingTransfer) return 0;
        if (coach.isDue) return 1;
        if (coach.followUpCount === 0) return 2;
        return 3;
    };
    return [...coaches].sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        if (a.pendingTransfer) return b.pendingTransfer.waitingDays - a.pendingTransfer.waitingDays;
        if (a.isDue) return a.nextFollowUpOn.localeCompare(b.nextFollowUpOn);
        if (a.followUpCount === 0) return a.daysSinceSignup - b.daysSinceSignup;
        return new Date(a.lastFollowUpAt) - new Date(b.lastFollowUpAt);
    });
}

// "Transfer 499 EGP · waiting 2 days · REF-1234"
export function describePendingTransfer(pendingTransfer) {
    const { amount, currency, waitingDays, referenceCode } = pendingTransfer;
    const waiting = waitingDays === 0 ? 'requested today' : `waiting ${waitingDays} ${waitingDays === 1 ? 'day' : 'days'}`;
    return `Transfer ${amount.toLocaleString()} ${currency} · ${waiting}${referenceCode ? ` · ${referenceCode}` : ''}`;
}

// "Due today", "3 days overdue", or the plain date for an upcoming reminder.
export function describeReminder(nextFollowUpOn) {
    if (!nextFollowUpOn) return null;
    const daysUntil = daysBetweenDates(cairoDate(), nextFollowUpOn);
    if (daysUntil === 0) return { text: 'Due today', isDue: true };
    if (daysUntil < 0) return { text: `${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? 'day' : 'days'} overdue`, isDue: true };
    return { text: daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`, isDue: false };
}
