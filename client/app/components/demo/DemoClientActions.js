'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";
import AppModal, { ModalFooter } from "@/app/components/Modal";
import DemoBadge from "@/app/components/demo/DemoBadge";

// Compact controls for the demo client, in the same row as its tabs: the "Demo" badge and the one-way "Delete demo
// client" action. The client app is opened from the sidebar's client portal link (the getting-started guide points there).
export default function DemoClientActions({ workspaceSlug }) {
    const t = useTranslations('demoClient');
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(false);

    async function deleteDemoClient() {
        setDeleting(true);
        setError(false);
        try {
            await api.delete('/api/demo-client');
            router.push(`/${workspaceSlug}/clients`);
        } catch {
            setError(true);
            setDeleting(false);
        }
    }

    return (
        <div className="flex items-center gap-1.5">
            <DemoBadge />

            <Button isIconOnly size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={t('deleteButton')} title={t('deleteButton')}>
                <Trash2 size={15} aria-hidden="true" />
            </Button>

            <AppModal open={confirming} onClose={() => !deleting && setConfirming(false)} title={t('deleteTitle')}>
                <p className="text-sm text-muted-foreground">{t('deleteBody')}</p>
                {error && <p className="mt-2 text-sm text-destructive">{t('deleteFailed')}</p>}
                <ModalFooter className="mt-4">
                    <Button variant="ghost" onClick={() => setConfirming(false)} isDisabled={deleting}>{t('cancel')}</Button>
                    <Button variant="danger" onClick={deleteDemoClient} isDisabled={deleting}>{t('deleteConfirm')}</Button>
                </ModalFooter>
            </AppModal>
        </div>
    );
}
