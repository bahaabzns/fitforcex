'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import api from '@/lib/axios';

/**
 * Payments are the only source of truth for whether a workspace can still make changes
 * (see server/src/middleware/subscriptionAccessGate.ts) — this banner just reflects that same
 * computed status back to the coach. Not dismissible: it describes a real, currently-active
 * restriction (writes are actually blocked with 402 by the gate), not an informational nudge.
 */
export default function SubscriptionReadOnlyBanner() {
    const { workspaceSlug } = useParams();
    const [status, setStatus] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/api/billing/subscription')
            .then(res => { if (!cancelled) setStatus(res.data?.subscription ?? null); })
            .catch(() => {}); // not the workspace owner, or no subscription row yet — stay silent
        return () => { cancelled = true; };
    }, [workspaceSlug]);

    if (!status?.isReadOnly) return null;

    return (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-sm text-amber-600 dark:text-amber-400 shrink-0">
            <TriangleAlert size={15} className="shrink-0" />
            <span>Your subscription has expired — you can still view everything, but changes are disabled until you renew.</span>
            <Link href={`/${workspaceSlug}/settings/subscription`} className="ms-auto font-semibold underline underline-offset-2 shrink-0">
                Renew now
            </Link>
        </div>
    );
}
