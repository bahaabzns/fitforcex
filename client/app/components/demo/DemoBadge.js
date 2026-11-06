'use client';

import { useTranslations } from "next-intl";

// Small "Demo" pill shown next to the demo client's name in lists and on its page.
export default function DemoBadge({ className = "" }) {
    const t = useTranslations('demoClient');
    return (
        <span className={`inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-yellow-700 ${className}`}>
            {t('badge')}
        </span>
    );
}
