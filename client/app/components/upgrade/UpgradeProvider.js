'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { trackUpgradeEvent, UPGRADE_SOURCE } from '@/lib/upgradeTracking';
import UpgradeModal from './UpgradeModal';

// Sources where the modal opens by itself (the coach never pressed an "Upgrade" button), so the
// admin report counts them as "shown" rather than as a click.
const AUTO_OPEN_SOURCES = new Set([UPGRADE_SOURCE.LIMIT_POPUP]);

const UpgradeContext = createContext(null);

/**
 * One place that knows the workspace's subscription (fetched once, owner only) and owns the single
 * upgrade modal. Every upgrade button — top bar, sidebar meter, lock icons, banners, the limit
 * popup — calls `openUpgrade({ source })` instead of building its own checkout.
 */
export default function UpgradeProvider({ children }) {
    const { workspaceSlug } = useParams();
    const [subscription, setSubscription] = useState(null);
    const [isOwner, setIsOwner] = useState(false);
    const [modal, setModal] = useState(null); // { source, reason, limit } while open

    const refreshSubscription = useCallback(() => {
        return api.get('/api/billing/subscription')
            .then(res => { setSubscription(res.data?.subscription ?? null); setIsOwner(true); })
            .catch(() => { setSubscription(null); setIsOwner(false); }); // 403 = team member, not the owner
    }, []);

    useEffect(() => { refreshSubscription(); }, [refreshSubscription, workspaceSlug]);

    const openUpgrade = useCallback(({ source, reason = 'default', limit = null }) => {
        trackUpgradeEvent({ eventType: AUTO_OPEN_SOURCES.has(source) ? 'shown' : 'click', source });
        setModal({ source, reason, limit });
    }, []);

    const closeUpgrade = useCallback(() => setModal(null), []);

    const value = useMemo(
        () => ({ subscription, isOwner, refreshSubscription, openUpgrade }),
        [subscription, isOwner, refreshSubscription, openUpgrade],
    );

    return (
        <UpgradeContext.Provider value={value}>
            {children}
            <UpgradeModal
                open={Boolean(modal)}
                onClose={closeUpgrade}
                onPaid={refreshSubscription}
                source={modal?.source}
                reason={modal?.reason}
                limit={modal?.limit}
                subscription={subscription}
                isOwner={isOwner}
            />
        </UpgradeContext.Provider>
    );
}

export function useUpgrade() {
    const context = useContext(UpgradeContext);
    if (!context) throw new Error('useUpgrade must be used inside <UpgradeProvider>');
    return context;
}
