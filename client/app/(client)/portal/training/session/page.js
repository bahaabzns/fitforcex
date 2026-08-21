"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { ChevronDown, Flag, Trash2 } from "lucide-react";
import { Spinner } from "@heroui/react/spinner";
import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react/modal";
import ExerciseLogCard from "@/app/components/training-mode/ExerciseLogCard";
import RestTimerBar from "@/app/components/training-mode/RestTimerBar";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import { formatDuration, completedSetCount } from "@/utils/workout";
import { categoryOf, prescribedFieldsFor, loggedFieldsFor } from "@/utils/exerciseTrackingTypes";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getActiveTrainingSession, saveTrainingSession, clearTrainingSession } from "@/lib/trainingSessionStore";

const DEFAULT_REST = 90;

// Wall-clock read kept out of the component body so it isn't treated as an
// impure call during render (react-hooks/purity).
const currentMillis = () => Date.now();

// Debounces `value` so callers don't fire a request on every keystroke —
// waits `delay`ms after the last change before updating the returned value.
// Same shape as settings/pdf/page.js's identical hook for its live preview.
function useDebouncedValue(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

function toNumber(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

// Minted client-side (not server-generated) the moment a session starts, so
// every debounced autosave and the final Finish both target the same
// workout_logs row via upsert (PUT /workout-logs/:id) instead of Finish
// creating a second one — see clientPortal.controller.ts's upsertWorkoutLog.
//
// crypto.randomUUID() alone isn't enough here: it's gated to secure contexts
// (HTTPS, or literally the hostname "localhost") and throws in any other
// context — which silently broke every "Start Training" click in this app's
// own dev environment (http://lvh.me:3000 doesn't qualify as secure despite
// resolving to 127.0.0.1). crypto.getRandomValues has no such restriction, so
// build an equivalent v4 UUID from it when randomUUID isn't available.
function newSessionId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        try { return crypto.randomUUID(); } catch { /* fall through to getRandomValues below */ }
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    // Last-resort fallback for an environment with no crypto API at all —
    // this id is just a client-picked primary key, not a security token, so
    // Math.random-based uniqueness is an acceptable final fallback.
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// A resumed session's exercise metadata (name, notes, instructions, video, …)
// is whatever was cached when the session started — it can silently go stale
// if the coach edits the plan mid-session, or (as happened here) if a field
// gets added to buildSession after the client already had a session cached.
// Re-derive metadata from the freshly fetched day on every resume; only the
// client's own logged data (sets, per-exercise note, start time) survives
// from storage. Reused for both the localStorage-restored shape and the
// server-draft shape (see draftToRestored below) — they're normalized to the
// same { id, day_id, started_at, exercises: [{exercise_id, note, sets}] } shape.
function resumeSession(fresh, restored) {
    const restoredById = new Map(restored.exercises.map(ex => [ex.exercise_id, ex]));
    return {
        ...fresh,
        // Pre-existing saved sessions (from before Instant Save shipped) won't
        // have an id yet — mint one rather than losing the ability to autosave.
        id:         restored.id || newSessionId(),
        started_at: restored.started_at,
        exercises: fresh.exercises.map(ex => {
            const saved = restoredById.get(ex.exercise_id);
            return saved ? { ...ex, note: saved.note, sets: saved.sets } : ex;
        }),
    };
}

// Converts a server draft (GET /workout-logs/draft — the same flat, already-
// numeric shape autosave sends, see serializeExercisesForApi) into the shape
// resumeSession expects. Nulls become "" so a controlled input never receives
// null as its value; numbers pass through unchanged (React renders them fine).
function draftToRestored(draft) {
    return {
        id:         draft.id,
        day_id:     draft.day_id,
        started_at: draft.started_at,
        exercises: (draft.exercises ?? []).map(ex => ({
            exercise_id: ex.exercise_id,
            note:        ex.note || "",
            sets: (ex.sets ?? []).map(s => ({
                set_order:        s.set_order,
                completed:        !!s.completed,
                rest_seconds:     s.rest_seconds ?? null,
                weight:           s.weight ?? "",
                reps:             s.reps ?? "",
                rir:              s.rir ?? "",
                rpe:              s.rpe ?? "",
                duration_seconds: s.duration_seconds ?? "",
                distance_km:      s.distance_km ?? "",
                incline_percent:  s.incline_percent ?? "",
                speed_kmh:        s.speed_kmh ?? "",
            })),
        })),
    };
}

// Shared by the debounced autosave and Finish — both must send the exact
// same shape so a mid-session autosave and the final save are interchangeable
// as far as the server's upsert is concerned.
function serializeExercisesForApi(exercises) {
    return exercises.map(ex => ({
        exercise_id:         ex.exercise_id,
        exercise_library_id: ex.exercise_library_id,
        name:                ex.name,
        library_name_en:     ex.library_name_en,
        library_name_ar:     ex.library_name_ar,
        note:                ex.note?.trim() || null,
        tracking_type:       ex.tracking_type,
        tracked_metrics:     ex.tracked_metrics,
        sets: ex.sets.map(s => ({
            set_order:        s.set_order,
            weight:           toNumber(s.weight),
            reps:             toNumber(s.reps),
            rir:              toNumber(s.rir),
            rpe:              toNumber(s.rpe),
            rest_seconds:     s.rest_seconds,
            duration_seconds: toNumber(s.duration_seconds),
            distance_km:      toNumber(s.distance_km),
            incline_percent:  toNumber(s.incline_percent),
            speed_kmh:        toNumber(s.speed_kmh),
            completed:        s.completed,
        })),
    }));
}

function buildSession(plan, day, dayIndex) {
    return {
        id:         newSessionId(),
        plan_id:    plan.id,
        day_id:     day.id,
        day_index:  dayIndex,
        day_name:   day.name,
        started_at: new Date().toISOString(),
        exercises: (day.exercises ?? []).map(ex => {
            const prescribed   = ex.sets ?? [];
            const setCount     = Math.max(1, prescribed.length);
            const prescribedFields = prescribedFieldsFor(ex);
            const loggedFields     = loggedFieldsFor(ex);
            return {
                exercise_id:         ex.id,
                exercise_library_id: ex.exercise_library_id ?? null,
                name:                ex.name,
                library_name_en:     ex.library_name_en ?? null,
                library_name_ar:     ex.library_name_ar ?? null,
                thumbnail_path:      ex.thumbnail_path ?? null,
                youtube_url:         ex.youtube_url ?? null,
                video_path:          ex.video_path ?? null,
                muscle_group:        ex.muscle_group ?? null,
                muscle_group_ar:     ex.muscle_group_ar ?? null,
                equipment:           ex.equipment ?? null,
                equipment_ar:        ex.equipment_ar ?? null,
                notes:               ex.notes ?? null,
                instructions_en:     ex.instructions_en ?? null,
                instructions_ar:     ex.instructions_ar ?? null,
                tracking_type:       categoryOf(ex),
                tracked_metrics:     ex.tracked_metrics ?? [],
                prescribed:          prescribed.map(s => Object.fromEntries(prescribedFields.map(f => [f, s[f]]))),
                note:                "",
                sets: Array.from({ length: setCount }, (_, i) => ({
                    set_order: i + 1,
                    completed: false,
                    // rest_seconds is auto-measured between completions (see
                    // toggleSet below), not a coach-selectable metric — every
                    // other logged field for this exercise starts blank.
                    rest_seconds: null,
                    ...Object.fromEntries(loggedFields.map(f => [f, ""])),
                })),
            };
        }),
    };
}

export default function TrainingSessionPage() {
    const t = useTranslations("portal.training");
    const tCommon = useTranslations("common");
    const router = useRouter();
    const searchParams = useSearchParams();
    const dayIndex = parseInt(searchParams.get("day"), 10) || 0;
    usePageTitle(t('workout'));

    const [session, setSession]   = useState(null);
    const [previous, setPrevious] = useState({});
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [now, setNow]           = useState(() => currentMillis());
    const [rest, setRest]         = useState(null); // { startedAt, target }
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
    const [finishEmptyOpen, setFinishEmptyOpen]       = useState(false);

    // Instant Save — debounced background autosave of the whole session
    // while the client is still working, so weights/reps typed mid-workout
    // survive a closed tab/crash/lost connection without waiting for Finish.
    // "error" only after several *consecutive* failures (see the effect
    // below) — a transient blip on one save isn't worth interrupting anyone.
    const [autosaveState, setAutosaveState] = useState("idle"); // idle | saving | saved | error
    // True once the initial session value (fresh or resumed) has landed —
    // autosave must not fire for that first value, only for real edits after.
    const hydratedRef = useRef(false);
    // Discards a stale autosave response if a newer one has since fired —
    // same request-id-guard pattern as settings/pdf/page.js's preview autosave.
    const autosaveRequestIdRef = useRef(0);
    const autosaveFailStreakRef = useRef(0);
    // Set the instant Finish is clicked so any autosave already queued behind
    // the debounce timer skips firing — Finish's own save supersedes it. Does
    // not cancel a request already in flight; the server's own check (a
    // completed row is never mutated again) covers that narrower race.
    const finishingRef = useRef(false);

    // State, not a ref: focusSetIndexFor reads it during render to drive
    // auto-focus, and refs can't be read while rendering (react-hooks/refs).
    const [lastCompletion, setLastCompletion] = useState(null);

    // Load plan + previous values; resume a saved session for the same day if present.
    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const { data: plan } = await api.get("/api/client-portal/active-training-plan");
                const day = plan?.days?.[dayIndex];
                if (!day || (day.exercises ?? []).length === 0) {
                    // A saved session pointing at this day is stale (plan changed
                    // since it was started) — clear it so the client isn't stuck
                    // bouncing back here forever on the next "Continue" tap.
                    clearTrainingSession();
                    router.replace("/portal/training");
                    return;
                }

                // Previous values are a nice-to-have — never let their failure
                // eject the client from the session they just started.
                try {
                    const { data: prevMap } = await api.get("/api/client-portal/workout-logs/previous", {
                        params: { day_id: day.id },
                    });
                    if (!cancelled) setPrevious(prevMap ?? {});
                } catch { /* no previous data available */ }
                if (cancelled) return;

                const saved = getActiveTrainingSession();
                let restored = saved && saved.day_id === day.id ? saved : null;

                // No local draft (cleared storage, browser crash, or a fresh
                // device) — check the server for one before giving up and
                // starting blank. A nice-to-have, same as previous values:
                // never let its failure block starting the session.
                if (!restored) {
                    try {
                        const { data: draft } = await api.get("/api/client-portal/workout-logs/draft", {
                            params: { day_id: day.id },
                        });
                        if (draft) restored = draftToRestored(draft);
                    } catch { /* no server draft available */ }
                    if (cancelled) return;
                }

                const fresh = buildSession(plan, day, dayIndex);
                setSession(restored ? resumeSession(fresh, restored) : fresh);
            } catch (e) {
                if (e.response?.status === 404) {
                    // No active plan at all — any saved session is stale.
                    clearTrainingSession();
                    router.replace("/portal/training");
                } else {
                    router.replace("/portal");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [dayIndex, router]);

    // 1s tick drives both the elapsed clock and the rest countdown.
    useEffect(() => {
        const id = setInterval(() => setNow(currentMillis()), 1000);
        return () => clearInterval(id);
    }, []);

    // Persist in-progress session so a refresh (or minimizing back to the day
    // preview) resumes it.
    useEffect(() => {
        if (session) saveTrainingSession(session);
    }, [session]);

    // Debounces `session` (700ms) so autosave doesn't fire on every keystroke
    // — same pattern as settings/pdf/page.js's live-preview autosave.
    const debouncedSession = useDebouncedValue(session, 700);

    // The actual server autosave — fires on every real edit (not the initial
    // load/resume value), independent of localStorage above. Data already
    // reaches the server here; Finish (below) only flips completed to true on
    // the same row instead of doing the one save that used to matter most.
    useEffect(() => {
        if (!debouncedSession) return;
        if (!hydratedRef.current) { hydratedRef.current = true; return; }
        if (finishingRef.current) return;

        const requestId = ++autosaveRequestIdRef.current;
        setAutosaveState("saving");
        api.put(`/api/client-portal/workout-logs/${debouncedSession.id}`, {
            plan_id:    debouncedSession.plan_id,
            day_id:     debouncedSession.day_id,
            day_index:  debouncedSession.day_index,
            notes:      null,
            started_at: debouncedSession.started_at,
            ended_at:   new Date().toISOString(),
            exercises:  serializeExercisesForApi(debouncedSession.exercises),
            completed:  false,
        }).then(() => {
            if (requestId !== autosaveRequestIdRef.current) return;
            autosaveFailStreakRef.current = 0;
            setAutosaveState("saved");
        }).catch(() => {
            if (requestId !== autosaveRequestIdRef.current) return;
            autosaveFailStreakRef.current += 1;
            // A background save failing on every flaky-connection blip would
            // be a worse experience than today's silence — only surface
            // something after a sustained run of failures.
            setAutosaveState(autosaveFailStreakRef.current >= 3 ? "error" : "saving");
        });
    }, [debouncedSession]);

    function updateExercise(exIdx, updater) {
        setSession(prev => {
            const exercises = prev.exercises.map((ex, i) => (i === exIdx ? updater(ex) : ex));
            return { ...prev, exercises };
        });
    }

    function changeSet(exIdx, setIdx, field, value) {
        updateExercise(exIdx, ex => ({
            ...ex,
            sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)),
        }));
    }

    function toggleSet(exIdx, setIdx) {
        const nowMs = currentMillis();
        setSession(prev => {
            const exercises = prev.exercises.map((ex, i) => {
                if (i !== exIdx) return ex;
                const sets = ex.sets.map((s, j) => (j === setIdx ? { ...s, completed: !s.completed } : s));
                return { ...ex, sets };
            });
            return { ...prev, exercises };
        });

        const wasCompleted = session?.exercises[exIdx]?.sets[setIdx]?.completed;
        if (wasCompleted) {
            // Un-checking: stop any rest tied to this set.
            if (lastCompletion?.exIdx === exIdx && lastCompletion?.setIdx === setIdx) {
                setLastCompletion(null);
                setRest(null);
            }
            return;
        }

        // Completing: measure the rest taken since the previous set of this exercise.
        if (lastCompletion && lastCompletion.exIdx === exIdx && lastCompletion.setIdx === setIdx - 1) {
            const measured = Math.round((nowMs - lastCompletion.at) / 1000);
            updateExercise(exIdx, ex => ({
                ...ex,
                sets: ex.sets.map((s, j) => (j === setIdx - 1 ? { ...s, rest_seconds: measured } : s)),
            }));
        }
        setLastCompletion({ exIdx, setIdx, at: nowMs });

        const target = Number(session?.exercises[exIdx]?.prescribed?.[setIdx]?.rest_seconds) || DEFAULT_REST;
        setRest({ startedAt: nowMs, target });
    }

    function changeNote(exIdx, value) {
        updateExercise(exIdx, ex => ({ ...ex, note: value }));
    }

    function discard() {
        setDiscardConfirmOpen(true);
    }

    function confirmDiscard() {
        setDiscardConfirmOpen(false);
        finishingRef.current = true; // stop any queued autosave from resurrecting the row we're about to delete
        clearTrainingSession();
        // Best-effort — an explicit discard should remove the autosaved
        // draft, not just the local cache, but a failed cleanup call is no
        // reason to block the client from leaving.
        if (session?.id) api.delete(`/api/client-portal/workout-logs/${session.id}`).catch(() => {});
        router.replace("/portal/training");
    }

    function minimize() {
        router.push("/portal/training");
    }

    function finish() {
        const completed = completedSetCount(session.exercises);
        if (completed === 0) { setFinishEmptyOpen(true); return; }
        submitFinish();
    }

    function confirmFinishEmpty() {
        setFinishEmptyOpen(false);
        submitFinish();
    }

    async function submitFinish() {
        setSaving(true);
        // Stops any autosave still queued behind the debounce timer from
        // firing after this — Finish's own save (below) is the authoritative
        // final write, targeting the exact same row by id.
        finishingRef.current = true;
        try {
            const { data } = await api.put(`/api/client-portal/workout-logs/${session.id}`, {
                plan_id:    session.plan_id,
                day_id:     session.day_id,
                day_index:  session.day_index,
                notes:      null,
                started_at: session.started_at,
                ended_at:   new Date().toISOString(),
                exercises:  serializeExercisesForApi(session.exercises),
                completed:  true,
            });
            clearTrainingSession();
            const params = new URLSearchParams({
                dayName:  session.day_name,
                duration: String(data.duration_seconds ?? ""),
                volume:   String(data.total_volume ?? ""),
                sets:     String(data.total_sets ?? ""),
            });
            router.replace(`/portal/training/session/complete?${params.toString()}`);
        } catch {
            setSaving(false);
            finishingRef.current = false; // let autosave resume if the client keeps editing and retries
            window.alert(t("saveFailed"));
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner size="lg" />
            </div>
        );
    }
    if (!session) return null;

    const elapsedSeconds = Math.floor((now - new Date(session.started_at).getTime()) / 1000);
    const restRemaining  = rest ? Math.ceil(rest.target - (now - rest.startedAt) / 1000) : null;

    // Once a set completes, focus follows to the next set's weight field —
    // but only while its rest countdown is still showing, mirroring the
    // mobile app's "keep typing without reaching for the mouse" flow.
    function focusSetIndexFor(exIdx) {
        return restRemaining != null && lastCompletion?.exIdx === exIdx ? lastCompletion.setIdx + 1 : null;
    }

    return (
        <div className="max-w-4xl mx-auto flex flex-col">
            {/* Sticky session header */}
            <div className="sticky top-14 z-30 bg-background px-6 pt-4 pb-3 flex items-center gap-3 border-b border-border">
                <span title={t("minimizeSession")}>
                    <NewFeatureTooltip
                        featureKey="minimize_session_hint"
                        active
                        message={t("minimizeSessionHint")}
                        dismissLabel={t("minimizeSessionHintDismiss")}
                        badgeLabel={t("minimizeSessionNewFeature")}
                        onTriggerClick={minimize}
                        triggerClassName="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-default hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ChevronDown className="w-5 h-5" />
                    </NewFeatureTooltip>
                </span>
                <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                    <span className="text-xl font-bold text-foreground tabular-nums leading-tight">{formatDuration(elapsedSeconds)}</span>
                    {autosaveState === "error" && (
                        <span className="text-[11px] text-destructive leading-tight">{t("notSaved")}</span>
                    )}
                </div>
                <Button variant="primary" size="sm" onClick={finish} isDisabled={saving} className="shrink-0">
                    <Flag className="w-4 h-4" /> {saving ? t("saving") : t("finish")}
                </Button>
            </div>

            <div className="px-6 pt-3 pb-28 flex flex-col">
                <h1 className="text-xl font-bold text-foreground mb-4">{session.day_name}</h1>

                {session.exercises.map((exercise, exIdx) => (
                    <div key={exercise.exercise_id}>
                        {exIdx > 0 && <div className="my-4 border-t border-border/50" />}
                        <ExerciseLogCard
                            exercise={exercise}
                            previous={previous[exercise.exercise_id]}
                            focusSetIndex={focusSetIndexFor(exIdx)}
                            isFirstExercise={exIdx === 0}
                            onChangeSet={(setIdx, field, value) => changeSet(exIdx, setIdx, field, value)}
                            onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
                            onChangeNote={(value) => changeNote(exIdx, value)}
                        />
                    </div>
                ))}

                <Button variant="outline" onClick={discard} fullWidth className="mt-6 border-danger text-danger hover:bg-danger/10">
                    <Trash2 className="w-4 h-4" /> {t("discard")}
                </Button>
            </div>

            {rest && (
                <RestTimerBar
                    remaining={restRemaining}
                    target={rest.target}
                    onAdd={(secs) => setRest(r => ({ ...r, target: r.target + secs }))}
                    onSkip={() => setRest(null)}
                />
            )}

            {/* Discard confirmation */}
            <Modal isOpen={discardConfirmOpen} onOpenChange={(o) => !o && setDiscardConfirmOpen(false)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-sm">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>{t("discard")}</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                <p className="text-sm text-muted-foreground">{t("discardConfirm")}</p>
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setDiscardConfirmOpen(false)}>
                                    {tCommon("cancel")}
                                </Button>
                                <Button size="sm" variant="danger" onClick={confirmDiscard}>
                                    {t("discard")}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            {/* Finish-with-nothing-completed confirmation */}
            <Modal isOpen={finishEmptyOpen} onOpenChange={(o) => !o && setFinishEmptyOpen(false)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-sm">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>{t("finish")}</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                <p className="text-sm text-muted-foreground">{t("finishEmptyConfirm")}</p>
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setFinishEmptyOpen(false)}>
                                    {tCommon("cancel")}
                                </Button>
                                <Button size="sm" variant="primary" onClick={confirmFinishEmpty}>
                                    {t("finish")}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}
