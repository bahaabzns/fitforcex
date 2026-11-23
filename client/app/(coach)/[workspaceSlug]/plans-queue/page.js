"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { useTranslations } from "next-intl";
import { History, ListTodo } from "lucide-react";
import { Button } from "@heroui/react/button";
import AutoAssignMenu from "@/app/components/plansQueue/AutoAssignMenu";
import PlansQueueTable from "@/app/components/plansQueue/PlansQueueTable";
import ArchivedSubmissionsTable from "@/app/components/plansQueue/ArchivedSubmissionsTable";
import AutoAssignRulesModal from "@/app/components/plansQueue/AutoAssignRulesModal";
import PlansQueueSkeleton from "@/app/components/plansQueue/PlansQueueSkeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";

// The server already sends postAction/formType on every row; the form list is only a fallback for older rows.
function normalizeForms(rawForms) {
    return (rawForms || []).map((form) => ({
        ...form,
        postAction: form.postAction || form.post_action || "nothing",
        type: form.type || "check-in",
    }));
}

function normalizeQueueItems(rawItems, forms) {
    const formsById = new Map(forms.map((form) => [form.id, form]));
    return (rawItems || []).map((item) => {
        const matchingForm = formsById.get(item.formId);
        return {
            ...item,
            postAction: item.postAction || matchingForm?.postAction || "nothing",
            formType: item.formType || matchingForm?.type || "check-in",
            scheduledAt: item.scheduledAt || null,
        };
    });
}

export default function PlansQueuePage() {
    const t = useTranslations('plansQueue');
    const searchParams = useSearchParams();
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const [queueItems, setQueueItems] = useState([]);
    const [forms, setForms] = useState([]);
    const [members, setMembers] = useState([]);
    const [labels, setLabels] = useState([]);
    // Label management (create/rename/delete) is restricted to the workspace
    // owner or a 'manager' role — see forms.controller.ts's isManagerOrOwner.
    // Applying an existing label to a row stays available to anyone who can
    // see the queue at all, matching assignTo's 'forms' write gate.
    const [canManageLabels, setCanManageLabels] = useState(false);
    // "Auto-assign next time" rules. Same owner/manager restriction as labels (server enforces it), so
    // the one flag set from the role below also drives it. The page only keeps the rule COUNT (for the
    // button) — each queue row carries its own rule, and the modal fetches its own pages — so nothing
    // here grows with the number of rules.
    const [autoAssignTotal, setAutoAssignTotal] = useState(0);
    const [showAutoAssignRules, setShowAutoAssignRules] = useState(false);
    // The "remember who I assign to" switch. Remembered per workspace in this browser, so a manager who works
    // that way doesn't have to re-enable it every visit. Because it can now be on without the manager
    // remembering, the header button and the bulk bar both say so while it is on. Safe to read storage in the
    // initial state: the controls it drives only render after the queue has loaded, never in the server HTML.
    const autoAssignStorageKey = `plansQueue:autoAssignOnAssign:${workspaceSlug}`;
    const [autoAssignOnAssign, setAutoAssignOnAssignState] = useState(() => {
        try {
            return localStorage.getItem(autoAssignStorageKey) === "1";
        } catch {
            return false; // storage blocked (private window, site data cleared) — the switch just starts off
        }
    });
    function setAutoAssignOnAssign(isOn) {
        setAutoAssignOnAssignState(isOn);
        try {
            if (isOn) localStorage.setItem(autoAssignStorageKey, "1");
            else localStorage.removeItem(autoAssignStorageKey);
        } catch {
            // not remembered this time; the switch still works for this visit
        }
    }
    // Instant badge updates between reloads: `${clientId}:${planType}` -> { id, agentName } | null. Wins over
    // what the queue row came with (rows are a one-time snapshot).
    const [autoRuleOverrides, setAutoRuleOverrides] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showHistory, setShowHistory] = useState(false);
    usePageTitle(showHistory ? t('historyTitle') : t('title'));
    const [archivedItems, setArchivedItems] = useState([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    // Submission History needs every status, which the main view deliberately doesn't load (it only asks the
    // server for need-action rows). So History fetches its own full list the first time it is opened, and again
    // on each later open so it never shows rows the Main view has since changed. null = not loaded yet.
    const [historyItems, setHistoryItems] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [historyReloadToken, setHistoryReloadToken] = useState(0);
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
                const role = me.currentWorkspace?.role;
                setCanManageLabels(role === "owner" || role === "manager");
            } catch {
                // assignment is optional — leave members empty on failure
            }
        }
        loadMembers();
    }, []);

    // Fetched here (not inside PlansQueueTable) and passed to both the Main
    // and History table instances as a shared prop — otherwise the two views
    // could show out-of-sync label lists after a create/rename/delete in
    // whichever view's Manage Labels modal was used. refreshLabels bumps the
    // token below rather than calling setLabels directly, matching this
    // file's existing queueReloadToken pattern for the same reason: an
    // effect should synchronize with a dependency, not be invoked as a bare
    // imperative function.
    const [labelsReloadToken, setLabelsReloadToken] = useState(0);
    function refreshLabels() { setLabelsReloadToken((n) => n + 1); }
    // Same shape as the labels loader above: a token-driven effect shared by Main and History. pageSize=1
    // because only the total is wanted here.
    const [autoAssignReloadToken, setAutoAssignReloadToken] = useState(0);
    function refreshAutoAssignCount() { setAutoAssignReloadToken((n) => n + 1); }
    useEffect(() => {
        async function loadAutoAssignCount() {
            try {
                const res = await api.get("/api/forms/queue/auto-assign", { params: { pageSize: 1 } });
                // Rules, not clients: the list is one row per client, but the button counts the rules themselves.
                setAutoAssignTotal(res.data?.totalRules ?? 0);
            } catch {
                // optional UI — leave the existing count on failure
            }
        }
        loadAutoAssignCount();
    }, [autoAssignReloadToken]);

    function applyAutoRuleOverrides(entries) {
        setAutoRuleOverrides((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    }

    // Rules edited from the modal (agent changed, or turned off): update those rows' badges now, no reload.
    // Each entry is ["clientId:planType", { id, agentName } | null].
    function handleRulesChanged(entries) {
        applyAutoRuleOverrides(entries);
        refreshAutoAssignCount();
    }

    // "Turn off all matching" can touch thousands of rows, so reload the queue (remounts the table with
    // fresh rows) instead of patching badges one by one.
    function handleRulesTurnedOffInBulk() {
        setAutoRuleOverrides({});
        refreshAutoAssignCount();
        setQueueReloadToken((n) => n + 1);
        setHistoryReloadToken((n) => n + 1);
    }

    useEffect(() => {
        async function loadLabels() {
            try {
                const res = await api.get("/api/forms/queue/labels");
                setLabels(res.data || []);
            } catch {
                // labels are optional UI — leave the existing list on failure
            }
        }
        loadLabels();
    }, [labelsReloadToken]);

    useEffect(() => {
        async function loadQueue() {
            setLoading(true);
            setError("");
            try {
                // Main only shows rows the coach still has to act on, so only those are requested — and without
                // their answers (rows carry a count; the preview fetches one request's answers when opened).
                // A row the coach just finished in a builder is no longer need-action, but it comes back once
                // (includeId) so its completion animation can still play.
                const justActionedId = searchParams.get("justActioned");
                const [queueRes, formsRes] = await Promise.all([
                    api.get("/api/forms/queue", {
                        params: { view: "need-action", answers: "lazy", ...(justActionedId ? { includeId: justActionedId } : {}) },
                    }),
                    api.get("/api/forms"),
                ]);

                const loadedForms = normalizeForms(formsRes.data);
                setQueueItems(normalizeQueueItems(queueRes.data, loadedForms));
                setForms(loadedForms);
            } catch (err) {
                setError(err.response?.data?.error || "Failed to load plans queue");
            } finally {
                setLoading(false);
            }
        }

        loadQueue();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on the token; searchParams is read once per load
    }, [queueReloadToken]);

    useEffect(() => {
        if (!showHistory) return;

        async function loadArchived() {
            setArchivedLoading(true);
            try {
                const res = await api.get("/api/forms/queue", { params: { archived: "true", answers: "lazy" } });
                setArchivedItems(res.data || []);
            } catch {
                // archived section is secondary — leave empty on failure
            }
            setArchivedLoading(false);
        }

        loadArchived();
    }, [showHistory, historyReloadToken]);

    useEffect(() => {
        if (!showHistory) return;
        let cancelled = false;

        async function loadHistory() {
            setHistoryLoading(true);
            setHistoryError("");
            try {
                const res = await api.get("/api/forms/queue", { params: { answers: "lazy" } });
                if (!cancelled) setHistoryItems(res.data || []);
            } catch (err) {
                if (!cancelled) setHistoryError(err.response?.data?.error || "Failed to load plans queue");
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        }

        loadHistory();
        return () => { cancelled = true; };
    }, [showHistory, historyReloadToken]);

    // Restoring moves an item back into the active queue — refresh both lists so it
    // reappears there without requiring a manual page reload.
    function handleRestored(ids) {
        setArchivedItems((prev) => prev.filter((item) => !ids.includes(item.id)));
        setQueueReloadToken((n) => n + 1);
        setHistoryReloadToken((n) => n + 1);
    }

    // Full, unfiltered buckets — used by the Submission History view, which shows
    // every status alongside archived items.
    const normalizedHistory = useMemo(
        () => normalizeQueueItems(historyItems, forms),
        [historyItems, forms]
    );

    const awaiting = useMemo(
        () => normalizedHistory.filter((item) => item.status === "awaiting" || item.status === "scheduled"),
        [normalizedHistory]
    );

    const submissions = useMemo(
        () => normalizedHistory.filter((item) => item.status !== "awaiting" && item.status !== "scheduled"),
        [normalizedHistory]
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

    // PlansQueueTable keeps its rows in state captured once on mount, so a table must never mount before its
    // data is here: Main waits for `loading`, History for its own full list.
    const historyPending = showHistory && !historyError && (historyLoading || historyItems === null);
    if (loading || historyPending) {
        return (
            <PlansQueueSkeleton
                title={showHistory ? t('historyTitle') : undefined}
                description={showHistory ? t('historyDescription') : undefined}
            />
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
        <div className="flex items-center gap-2 flex-wrap">
            {(canManageLabels || autoAssignTotal > 0) && (
                <AutoAssignMenu
                    total={autoAssignTotal}
                    canManage={canManageLabels}
                    isOn={autoAssignOnAssign}
                    onIsOnChange={setAutoAssignOnAssign}
                    onOpenRules={() => setShowAutoAssignRules(true)}
                />
            )}
            <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory((prev) => !prev)}
            >
                {showHistory ? <ListTodo className="w-4 h-4" /> : <History className="w-4 h-4" />}
                <span>{showHistory ? t('backToQueue') : t('submissionHistory')}</span>
            </Button>
        </div>
    );

    return (
        <div className="p-8 overflow-auto h-full" ref={scrollContainerRef} onScroll={handleQueueScroll}>
            <TriggerInsightBanner
                triggerEvent="first_checkin_reviewed"
                checkUrl="/api/insights/prompts/for-trigger/first_checkin_reviewed"
                respondUrlPrefix="/api/insights/prompts"
                dismissUrlPrefix="/api/insights/prompts"
            />
            {showHistory && historyError ? (
                <div className="flex flex-col gap-4">
                    <div>{historyToggle}</div>
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive shadow-sm p-6">
                        {historyError}
                    </div>
                </div>
            ) : showHistory ? (
                <div className="flex flex-col gap-10">
                    <PlansQueueTable
                        initialSubmissions={submissions}
                        awaiting={awaiting}
                        forms={forms}
                        members={members}
                        labels={labels}
                        canManageLabels={canManageLabels}
                        onLabelsChange={refreshLabels}
                        autoAssignOnAssign={autoAssignOnAssign}
                        autoRuleOverrides={autoRuleOverrides}
                        onAutoRuleOverrides={applyAutoRuleOverrides}
                        canManageAutoAssign={canManageLabels}
                        onAutoAssignChange={refreshAutoAssignCount}
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
                    labels={labels}
                    canManageLabels={canManageLabels}
                    onLabelsChange={refreshLabels}
                    autoAssignOnAssign={autoAssignOnAssign}
                    autoRuleOverrides={autoRuleOverrides}
                    onAutoRuleOverrides={applyAutoRuleOverrides}
                    canManageAutoAssign={canManageLabels}
                    onAutoAssignChange={refreshAutoAssignCount}
                    hideStatusColumn
                    hideActionTakenColumn
                    headerAction={historyToggle}
                    completingId={completingId}
                    completingItem={completingItem}
                    onCompletionDone={handleCompletionDone}
                />
            )}
            <AutoAssignRulesModal
                open={showAutoAssignRules}
                onClose={() => setShowAutoAssignRules(false)}
                members={members}
                canManage={canManageLabels}
                onRulesChanged={handleRulesChanged}
                onTurnedOffInBulk={handleRulesTurnedOffInBulk}
            />
        </div>
    );
}
