
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

function makeTx(overrides = {}) {
    return {
        status: 'completed',
        duration: 30,
        start_mode: 'on_first_plan',
        subscription_start_date: null,
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

describe('computeSubscriptionStatus', () => {
    it('returns "No Subscriptions" when there are no transactions', () => {
        expect(computeSubscriptionStatus([], [], null)).toBe('No Subscriptions');
    });

    it('returns "Pre-start" when completed tx exists but no plan activated yet', () => {
        const tx = makeTx({ start_mode: 'on_first_plan' });
        expect(computeSubscriptionStatus([tx], [], null)).toBe('Pre-start');
    });

    it('returns "Active" when plan activated and within subscription window', () => {
        const tx = makeTx({ duration: 30, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(5); // activated 5 days ago, 30-day sub = 25 days remaining
        expect(computeSubscriptionStatus([tx], [], firstActivation)).toBe('Active');
    });

    it('returns "Expired" when subscription window has passed', () => {
        const tx = makeTx({ duration: 10, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(15); // activated 15 days ago, 10-day sub = expired 5 days ago
        expect(computeSubscriptionStatus([tx], [], firstActivation)).toBe('Expired');
    });

    it('returns "Active" for custom start date subscription', () => {
        const tx = makeTx({
            duration: 30,
            start_mode: 'custom',
            subscription_start_date: daysAgo(5),
        });
        expect(computeSubscriptionStatus([tx], [], null)).toBe('Active');
    });

    it('returns "Frozen" when inside a freeze window', () => {
        const tx = makeTx({ duration: 30, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(5);
        const freeze = {
            freeze_start_date: daysAgo(2),
            freeze_duration_days: 10,
        };
        expect(computeSubscriptionStatus([tx], [freeze], firstActivation)).toBe('Frozen');
    });

    it('extends subscription end date by freeze duration', () => {
        // 10-day sub, started 12 days ago — would normally be Expired
        // But a 5-day freeze started 8 days ago, which adds 5 days → now expires tomorrow
        const tx = makeTx({ duration: 10, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(12);
        const freeze = {
            freeze_start_date: daysAgo(8),
            freeze_duration_days: 5,
        };
        // 12 days ago start + 10 day duration + 5 day freeze = expires 3 days from now
        expect(computeSubscriptionStatus([tx], [freeze], firstActivation)).toBe('Active');
    });

    it('queues second subscription to start when first ends', () => {
        const tx1 = makeTx({
            duration: 10,
            start_mode: 'on_first_plan',
            created_at: daysAgo(20),
        });
        const tx2 = makeTx({
            duration: 30,
            start_mode: 'queued',
            created_at: daysAgo(5),
        });
        const firstActivation = daysAgo(15);
        // tx1: starts 15 days ago, runs 10 days, ends 5 days ago
        // tx2: queued, starts 5 days ago (where tx1 ended), runs 30 days
        expect(computeSubscriptionStatus([tx1, tx2], [], firstActivation)).toBe('Active');
    });
});
