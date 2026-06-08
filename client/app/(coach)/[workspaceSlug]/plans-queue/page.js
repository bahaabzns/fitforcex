"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { useTranslations } from "next-intl";
import PlansQueueTable from "@/app/components/plansQueue/PlansQueueTable";

export default function PlansQueuePage() {
    const t = useTranslations('plansQueue');
    const [queueItems, setQueueItems] = useState([]);
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadQueue() {
            setLoading(true);
            setError("");
            try {
                const [queueRes, formsRes] = await Promise.all([
                    api.get("/api/forms/queue"),
                    api.get("/api/forms"),
                ]);

                const formsWithQuestions = await Promise.all(
                    (formsRes.data || []).map(async (form) => {
                        try {
                            const questionsRes = await api.get(`/api/forms/${form.id}/questions`);
                            return {
                                ...form,
                                postAction: form.postAction || form.post_action || "nothing",
                                type: form.type || "check-in",
                                questions: questionsRes.data || [],
                            };
                        } catch {
                            return {
                                ...form,
                                postAction: form.postAction || form.post_action || "nothing",
                                type: form.type || "check-in",
                                questions: [],
                            };
                        }
                    })
                );

                const normalizedQueue = (queueRes.data || []).map((item) => {
                    const matchingForm = formsWithQuestions.find((f) => f.id === item.formId);
                    return {
                        ...item,
                        postAction: item.postAction || matchingForm?.postAction || "nothing",
                        formType: item.formType || matchingForm?.type || "check-in",
                        scheduledAt: item.scheduledAt || null,
                    };
                });

                setQueueItems(normalizedQueue);
                setForms(formsWithQuestions);
            } catch (err) {
                setError(err.response?.data?.error || "Failed to load plans queue");
            } finally {
                setLoading(false);
            }
        }

        loadQueue();
    }, []);

    const awaiting = useMemo(
        () => queueItems.filter((item) => item.status === "awaiting" || item.status === "scheduled"),
        [queueItems]
    );

    const submissions = useMemo(
        () => queueItems.filter((item) => item.status !== "awaiting" && item.status !== "scheduled"),
        [queueItems]
    );

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('loadingQueue')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive shadow-sm p-6">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 overflow-auto h-full">
            <PlansQueueTable
                initialSubmissions={submissions}
                awaiting={awaiting}
                forms={forms}
            />
        </div>
    );
}
