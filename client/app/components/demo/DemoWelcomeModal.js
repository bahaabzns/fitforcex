'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppModal from "@/app/components/Modal";
import DemoShowcase from "@/app/components/demo/DemoShowcase";
import { markDemoWelcomeSeen } from "@/lib/demoClient";

// Shown once on the dashboard to coaches who did not go through signup onboarding (which carries the same
// showcase itself). Closing it any way counts as seen.
export default function DemoWelcomeModal({ status, workspaceSlug, onClose }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    async function finish(navigateTo) {
        setBusy(true);
        await markDemoWelcomeSeen();
        onClose();
        if (navigateTo) router.push(navigateTo);
    }

    return (
        <AppModal open onClose={() => finish(null)} title="" sheetOnMobile>
            <DemoShowcase
                busy={busy}
                onOpen={() => finish(`/${workspaceSlug}/dashboard?checklist=1`)}
                onSkip={() => finish(null)}
            />
        </AppModal>
    );
}
