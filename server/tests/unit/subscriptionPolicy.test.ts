import {
    DEFAULT_EXPIRED_POLICY,
    DEFAULT_FROZEN_POLICY,
    PERMISSION_KEYS,
    pickPermissions,
    resolveAccess,
    type PolicyPermissions,
} from '../../src/utils/subscriptionPolicy';
import { computeSubscriptionDetails } from '../../src/utils/subscriptionStatus';

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}

const allTrue = PERMISSION_KEYS.reduce((a, k) => ({ ...a, [k]: true }), {} as PolicyPermissions);
const allFalse = PERMISSION_KEYS.reduce((a, k) => ({ ...a, [k]: false }), {} as PolicyPermissions);

describe('subscription policy defaults', () => {
    it('defaults to a read-only portal: views on, actions off', () => {
        expect(DEFAULT_EXPIRED_POLICY.keep_portal_access).toBe(true);
        expect(DEFAULT_EXPIRED_POLICY.view_training_plans).toBe(true);
        expect(DEFAULT_EXPIRED_POLICY.view_nutrition_plans).toBe(true);
        expect(DEFAULT_EXPIRED_POLICY.view_progress_history).toBe(true);
        expect(DEFAULT_EXPIRED_POLICY.view_assessments).toBe(true);
        expect(DEFAULT_EXPIRED_POLICY.view_checkins).toBe(true);
        expect(DEFAULT_EXPIRED_POLICY.allow_messaging).toBe(false);
        expect(DEFAULT_EXPIRED_POLICY.allow_submit_checkins).toBe(false);
        expect(DEFAULT_EXPIRED_POLICY.allow_booking_appointments).toBe(false);
        expect(DEFAULT_EXPIRED_POLICY.allow_download_files).toBe(false);
        expect(DEFAULT_EXPIRED_POLICY.grace_period_days).toBe(0);
    });

    it('frozen default mirrors expired flags', () => {
        expect(pickPermissions(DEFAULT_FROZEN_POLICY)).toEqual(pickPermissions(DEFAULT_EXPIRED_POLICY));
    });
});

describe('pickPermissions', () => {
    it('keeps only the 10 flags and drops grace_period_days', () => {
        const picked = pickPermissions({ ...allTrue, grace_period_days: 30 } as never);
        expect(Object.keys(picked).sort()).toEqual([...PERMISSION_KEYS].sort());
        expect('grace_period_days' in picked).toBe(false);
    });

    it('coerces missing flags to false', () => {
        expect(pickPermissions({ allow_messaging: true })).toMatchObject({ allow_messaging: true, keep_portal_access: false });
    });
});

describe('resolveAccess', () => {
    const policies = { expired: DEFAULT_EXPIRED_POLICY, frozen: DEFAULT_FROZEN_POLICY };

    it('grants full access to Active and Pre-start clients', () => {
        expect(resolveAccess('Active', policies)).toEqual(allTrue);
        expect(resolveAccess('Pre-start', policies)).toEqual(allTrue);
    });

    it('applies the expired policy to Expired clients', () => {
        expect(resolveAccess('Expired', policies)).toEqual(pickPermissions(DEFAULT_EXPIRED_POLICY));
    });

    it('applies the frozen policy to Frozen clients', () => {
        const frozen = { ...DEFAULT_FROZEN_POLICY, allow_messaging: true };
        expect(resolveAccess('Frozen', { expired: DEFAULT_EXPIRED_POLICY, frozen }).allow_messaging).toBe(true);
    });

    it('closes the portal for Cancelled clients', () => {
        expect(resolveAccess('Cancelled', policies)).toEqual(allFalse);
    });

    it('grants full access to No Subscriptions clients so onboarding is never blocked', () => {
        expect(resolveAccess('No Subscriptions', policies)).toEqual(allTrue);
    });
});

describe('computeSubscriptionDetails grace inputs', () => {
    it('returns Expired with a currentPeriodEnd so a grace window can be applied', () => {
        const tx = {
            status: 'completed',
            duration: 30,
            start_mode: 'custom',
            subscription_start_date: daysAgo(60),
            created_at: daysAgo(60),
        };
        const details = computeSubscriptionDetails([tx], [], null);
        expect(details.status).toBe('Expired');
        expect(details.currentPeriodEnd).toBeInstanceOf(Date);
    });
});
