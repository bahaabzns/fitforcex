"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { useTranslations } from "next-intl";
import { History, ListTodo } from "lucide-react";
import { Button } from "@heroui/react/button";
import PlansQueueTable from "@/app/components/plansQueue/PlansQueueTable";
import ArchivedSubmissionsTable from "@/app/components/plansQueue/ArchivedSubmissionsTable";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function PlansQueuePage() {
    const t = useTranslations('plansQueue');
    const searchParams = useSearchParams();
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const [queueItems, setQueueItems] = useState([]);
    const [forms, setForms] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showHistory, setShowHistory] = useState(false);
    usePageTitle(showHistory ? t('historyTitle') : t('title'));
    const [archivedItems, setArchivedItems] = useState([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    // Bumped after a restore to re-run the queue-loading effect below, so a
    // restored submission reappears in the active queue without a full page reload.
    const [queueReloadToken, setQueueReloadToken] = useState(0);

    // ── Just-completed submission (?justActioned=<id>&returnTo=main|history) ──
    // Set once by the builder's "return to queue" redirect (see
    // nutrition/training page.js's handleActivateAndMark). Claimed here,
    // once, rather than inside PlansQueueTable — this page also needs to know
    // when it's safe to drop the item from the Main queue's data (see
    // completingItem below), which PlansQueueTable alone can't decide.
    //
    // returnTo decides which view to land on — NOT the item's status. Main
    // structurally excludes action-done items, so if the coach was on Main
    // when they clicked into the builder, they stay on Main and watch the
    // row play its completion animation and collapse out (PlansQueueTable +
    // DataTable's rowTransition); if they were on History, they stay there
    // and get the older, simpler fade-highlight (the item already belongs
    // there permanently). Falls back to Main when returnTo is absent (e.g. a
    // stale bookmarked URL from before this existed).
    //
    // The setTimeout(fn, 0) + sessionStorage claim mirror the pattern built
    // for this same problem one level down in PlansQueueTable.js: React 18
    // Strict Mode's dev-mode mount→cleanup→mount happens synchronously,
    // before any timer fires, so deferring the real work by one macrotask
    // means the discarded first instance's cleanup cancels its own pending
    // timer before it can run — only the surviving instance ever claims the
    // id, strips the URL, and sets state.
    const [completingId, setCompletingId] = useState(null);
    useEffect(() => {
        const id = searchParams.get("justActioned");
        if (!id) return;
        const returnTo = searchParams.get("returnTo");
        let cancelled = false;
        const claimTimer = setTimeout(() => {
            if (cancelled) return;
            const claimKey = `plans-queue-justActioned-claimed:${id}`;
            if (sessionStorage.getItem(claimKey)) return; // defense in depth — a genuine duplicate mount, not Strict Mode's
            sessionStorage.setItem(claimKey, "1");
            setCompletingId(id);
            if (returnTo === "history") setShowHistory(true);
            router.replace(`/${workspaceSlug}/plans-queue`, { scroll: false });
        }, 0);
        return () => {
            cancelled = true;
            clearTimeout(claimTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once for the id captured at mount
    }, []);
    // PlansQueueTable calls this once the row's completion animation has
    // fully finished (Main: after it's visually collapsed to nothing;
    // History: right away, nothing to remove there) — only then is it safe
    // to let completingItem drop back to null.
    function handleCompletionDone(id) {
        setCompletingId((prev) => (prev === id ? null : prev));
    }

    // ── Scroll position (survives navigating away to a builder and back) ──
    // This page fully unmounts when the coach clicks into a builder, so an
    // in-memory scroll offset can't survive the round trip — sessionStorage
    // does. Scoped per view (main vs. history), like persistKey above, since
    // they render completely different content at completely different
    // heights. Saved continuously on scroll; restored exactly once, after
    // the first successful load — restoring earlier would set scrollTop
    // against a container that hasn't laid out its rows yet.
    const scrollContainerRef = useRef(null);
    const scrollRestoredRef  = useRef(false);
    const scrollStorageKey   = workspaceSlug
        ? `plans-queue-scroll-${showHistory ? "history" : "main"}-${workspaceSlug}`
        : null;

    function handleQueueScroll() {
        if (!scrollStorageKey) return;
        sessionStorage.setItem(scrollStorageKey, String(scrollContainerRef.current?.scrollTop ?? 0));
    }

    useEffect(() => {
        if (loading || scrollRestoredRef.current || !scrollStorageKey) return;
        scrollRestoredRef.current = true;
        const saved = Number(sessionStorage.getItem(scrollStorageKey));
        if (!saved) return;
        // Wait a frame so the just-rendered table has real row heights to scroll against.
        requestAnimationFrame(() => {
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = saved;
        });
    }, [loading, scrollStorageKey]);

    useEffect(() => {
        async function loadMembers() {
            try {
                const meRes = await api.get("/api/auth/me");
                const me = meRes.data;
                const wsId = me.currentWorkspace?.id;
                let list = [];
                if (wsId) {
                    const mres = await api.get(`/api/workspaces/${wsId}/members`).catch(() => ({ data: [] }));
                    list = (mres.data || []).map((m) => ({
                        id: m.user_id,
                        name: `${m.fname ?? ""} ${m.lname ?? ""}`.trim() || m.email,
                    }));
                }
                // Ensure the signed-in coach (often the owner, who may not appear in the
                // members list) is always an assignable option.
                if (me.userId && !list.some((x) => x.id === me.userId)) {
                    list = [{ id: me.userId, name: `${me.fname ?? ""} ${me.lname ?? ""}`.trim() || me.email }, ...list];
                }
                setMembers(list);
            } catch {
                // assignment is optional — leave members empty on failure
            }
        }
        loadMembers();
    }, []);

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
    }, [queueReloadToken]);

    useEffect(() => {
        if (!showHistory) return;

        async function loadArchived() {
            setArchivedLoading(true);
            try {
                const res = await api.get("/api/forms/queue", { params: { archived: "true" } });
                setArchivedItems(res.data || []);
            } catch {
                // archived section is secondary — leave empty on failure
            }
            setArchivedLoading(false);
        }

        loadArchived();
    }, [showHistory]);

    // Restoring moves an item back into the active queue — refresh both lists so it
    // reappears there without requiring a manual page reload.
    function handleRestored(ids) {
        setArchivedItems((prev) => prev.filter((item) => !ids.includes(item.id)));
        setQueueReloadToken((n) => n + 1);
    }

    // Full, unfiltered buckets — used by the Submission History view, which shows
    // every status alongside archived items.
    const awaiting = useMemo(
        () => queueItems.filter((item) => item.status === "awaiting" || item.status === "scheduled"),
        [queueItems]
    );

    const submissions = useMemo(
        () => queueItems.filter((item) => item.status !== "awaiting" && item.status !== "scheduled"),
        [queueItems]
    );

    // The main page is scoped to just what the coach needs to act on today.
    const needActionItems = useMemo(
        () => queueItems.filter((item) => item.status === "need-action"),
        [queueItems]
    );

    // Full row data for the just-completed item (its status has already
    // flipped to action-done by the time we're back here, so it's no longer
    // in needActionItems above). Passed down as a prop rather than folded
    // into needActionItems/initialSubmissions — PlansQueueTable captures
    // `initialSubmissions` into local state exactly once on mount
    // (useState(initialSubmissions), never re-synced, so it can carry its
    // own optimistic updates from markReviewed etc. without a parent refetch
    // clobbering them) and would never pick up a later change to this array.
    // PlansQueueTable injects this directly into what it renders instead.
    const completingItem = useMemo(
        () => (completingId ? queueItems.find((item) => item.id === completingId) ?? null : null),
        [queueItems, completingId]
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

    const historyToggle = (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
        >
            {showHistory ? <ListTodo className="w-4 h-4" /> : <History className="w-4 h-4" />}
            <span>{showHistory ? t('backToQueue') : t('submissionHistory')}</span>
        </Button>
    );

    return (
        <div className="p-8 overflow-auto h-full" ref={scrollContainerRef} onScroll={handleQueueScroll}>
            {showHistory ? (
                <div className="flex flex-col gap-10">
                    <PlansQueueTable
                        initialSubmissions={submissions}
                        awaiting={awaiting}
                        forms={forms}
                        members={members}
                        title={t('historyTitle')}
                        description={t('historyDescription')}
                        headerAction={historyToggle}
                        completingId={completingId}
                        onCompletionDone={handleCompletionDone}
                    />

                    <div>
                        <h2 className="text-xl font-bold">{t('archivedSectionTitle')}</h2>
                        <p className="text-muted-foreground text-sm mt-1">{t('archivedSectionDesc')}</p>
                        {archivedLoading ? (
                            <p className="text-sm text-muted-foreground mt-4">{t('loadingQueue')}</p>
                        ) : (
                            <div className="mt-4">
                                <ArchivedSubmissionsTable items={archivedItems} onRestored={handleRestored} />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <PlansQueueTable
                    initialSubmissions={needActionItems}
                    awaiting={[]}
                    forms={forms}
                    members={members}
                    hideStatusColumn
                    hideActionTakenColumn
                    headerAction={historyToggle}
                    completingId={completingId}
                    completingItem={completingItem}
                    onCompletionDone={handleCompletionDone}
                />
            )}
        </div>
    );
}
