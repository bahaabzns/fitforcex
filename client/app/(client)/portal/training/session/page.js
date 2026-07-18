"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Flag, Trash2 } from "lucide-react";
import { Spinner } from "@heroui/react/spinner";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { Modal } from "@heroui/react/modal";
import ExerciseLogCard from "@/app/components/training-mode/ExerciseLogCard";
import RestTimerBar from "@/app/components/training-mode/RestTimerBar";
import { formatDuration, totalVolume, completedSetCount } from "@/utils/workout";
import { usePageTitle } from "@/hooks/usePageTitle";

const STORAGE_KEY  = "ff_training_session";
const DEFAULT_REST = 90;

// Wall-clock read kept out of the component body so it isn't treated as an
// impure call during render (react-hooks/purity).
const currentMillis = () => Date.now();

function toNumber(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

function buildSession(plan, day, dayIndex) {
    return {
        plan_id:    plan.id,
        day_id:     day.id,
        day_index:  dayIndex,
        day_name:   day.name,
        started_at: new Date().toISOString(),
        exercises: (day.exercises ?? []).map(ex => {
            const prescribed = ex.sets ?? [];
            const setCount   = Math.max(1, prescribed.length);
            return {
                exercise_id:         ex.id,
                exercise_library_id: ex.exercise_library_id ?? null,
                name:                ex.name,
                thumbnail_path:      ex.thumbnail_path ?? null,
                youtube_url:         ex.youtube_url ?? null,
                video_path:          ex.video_path ?? null,
                muscle_group:        ex.muscle_group ?? null,
                equipment:           ex.equipment ?? null,
                instructions_en:     ex.instructions_en ?? null,
                instructions_ar:     ex.instructions_ar ?? null,
                prescribed:          prescribed.map(s => ({ reps: s.reps, rest_seconds: s.rest_seconds, rir: s.rir, tempo: s.tempo })),
                note:                "",
                sets: Array.from({ length: setCount }, (_, i) => ({
                    set_order: i + 1, weight: "", reps: "", rir: "", rest_seconds: null, completed: false,
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

                let restored = null;
                try {
                    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
                    if (saved && saved.day_id === day.id) restored = saved;
                } catch { /* ignore corrupt storage */ }

                setSession(restored ?? buildSession(plan, day, dayIndex));
            } catch (e) {
                if (e.response?.status === 404) router.replace("/portal/training");
                else router.replace("/portal");
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

    // Persist in-progress session so a refresh resumes it.
    useEffect(() => {
        if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }, [session]);

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
        localStorage.removeItem(STORAGE_KEY);
        router.replace("/portal/training");
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
        try {
            await api.post("/api/client-portal/workout-logs", {
                plan_id:    session.plan_id,
                day_id:     session.day_id,
                day_index:  session.day_index,
                notes:      null,
                started_at: session.started_at,
                ended_at:   new Date().toISOString(),
                exercises: session.exercises.map(ex => ({
                    exercise_id:         ex.exercise_id,
                    exercise_library_id: ex.exercise_library_id,
                    name:                ex.name,
                    note:                ex.note?.trim() || null,
                    sets: ex.sets.map(s => ({
                        set_order:    s.set_order,
                        weight:       toNumber(s.weight),
                        reps:         toNumber(s.reps),
                        rir:          toNumber(s.rir),
                        rest_seconds: s.rest_seconds,
                        completed:    s.completed,
                    })),
                })),
            });
            localStorage.removeItem(STORAGE_KEY);
            router.replace("/portal/training/history");
        } catch {
            setSaving(false);
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
                <Tooltip>
                    <Button isIconOnly variant="ghost" size="sm" onClick={discard} aria-label={t("discard")} className="shrink-0 text-muted-foreground hover:text-danger">
                        <Trash2 className="w-5 h-5" />
                    </Button>
                    <Tooltip.Content>{t("discard")}</Tooltip.Content>
                </Tooltip>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold text-foreground truncate">{session.day_name}</h1>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(elapsedSeconds)} · {totalVolume(session.exercises)} {t("volumeUnit")}</span>
                </div>
                <Button variant="primary" size="sm" onClick={finish} isDisabled={saving} className="shrink-0">
                    <Flag className="w-4 h-4" /> {saving ? t("saving") : t("finish")}
                </Button>
            </div>

            <div className="px-6 pt-3 pb-28 flex flex-col">
                {session.exercises.map((exercise, exIdx) => (
                    <div key={exercise.exercise_id}>
                        {exIdx > 0 && <div className="my-4 border-t border-border/50" />}
                        <ExerciseLogCard
                            exercise={exercise}
                            previous={previous[exercise.exercise_id]}
                            focusSetIndex={focusSetIndexFor(exIdx)}
                            onChangeSet={(setIdx, field, value) => changeSet(exIdx, setIdx, field, value)}
                            onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
                            onChangeNote={(value) => changeNote(exIdx, value)}
                        />
                    </div>
                ))}
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
