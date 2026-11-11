'use client';

import { TriangleAlert } from 'lucide-react';
import { useUpgrade } from '@/app/components/upgrade/UpgradeProvider';
import { UPGRADE_SOURCE } from '@/lib/upgradeTracking';

/**
 * Payments are the only source of truth for whether a workspace can still make changes
 * (see server/src/middleware/subscriptionAccessGate.ts) — this banner just reflects that same
 * computed status back to the coach. Not dismissible: it describes a real, currently-active
 * restriction (writes are actually blocked with 402 by the gate), not an informational nudge.
 * "Renew now" opens the shared upgrade modal; team members (who can't pay) see no subscription
 * data and therefore no banner.
 */
export default function SubscriptionReadOnlyBanner() {
    const { subscription, openUpgrade } = useUpgrade();

    if (!subscription?.isReadOnly) return null;

    return (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-sm text-amber-600 dark:text-amber-400 shrink-0">
            <TriangleAlert size={15} className="shrink-0" />
            <span>Your subscription has expired — you can still view everything, but changes are disabled until you renew.</span>
            <button
                type="button"
                onClick={() => openUpgrade({ source: UPGRADE_SOURCE.EXPIRY_BANNER, reason: 'expired' })}
                className="ms-auto font-semibold underline underline-offset-2 shrink-0"
            >
                Renew now
            </button>
        </div>
    );
}
