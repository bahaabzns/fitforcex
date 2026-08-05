"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight, ChevronDown, Play, History, LineChart, BookOpen } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import ExerciseVideoPlayer from "@/app/components/training-mode/ExerciseVideoPlayer";
import ClientExerciseInsightsModal from "@/app/components/training-mode/ClientExerciseInsightsModal";
import ExerciseInstructionsModal from "@/app/components/training-mode/ExerciseInstructionsModal";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import { usePageTitle } from "@/hooks/usePageTitle";
import { planKey, setSeenPlanKey } from "@/lib/lastSeenStore";
import { getActiveTrainingSession } from "@/lib/trainingSessionStore";
import { formatDuration, formatClock, hasTempoValue, hasRirValue } from "@/utils/workout";
import { categoryOf, prescribedFieldsFor } from "@/utils/exerciseTrackingTypes";

// Which prescribed fields this read-only preview shows — driven entirely by
// the coach's per-exercise metric checklist (tracked_metrics, set in the
// exercise library), not by whether any particular set happens to have a
// value yet. rest_seconds is never shown here (matches the pre-existing
// behavior, which never showed a rest column either).
const FIELD_LABEL_KEY = { reps: "reps", tempo: "tempo", rir: "rir", rpe: "rpe", duration_seconds: "duration", distance_km: "distance", incline_percent: "incline", speed_kmh: "speed" };
function formatFieldValue(field, value) {
    if (value == null || value === "") return "—";
    return field === "duration_seconds" ? formatClock(value) : String(value);
}
// tempo's "not filled in" sentinel is the literal string "-" (see
// useTrainingPlan.js's defaultSetFor) — a plain null/blank check alone would
// treat that as a real value. rir has its own similar existing helper.
function hasTargetValue(field, value) {
    if (field === "tempo") return hasTempoValue(value);
    if (field === "rir") return hasRirValue(value);
    return value !== null && value !== undefined && value !== "";
}

// Precomputed whole Tailwind arbitrary-value grid templates — kept as
// complete literal strings (never built by interpolating a variable into the
// middle of one) so Tailwind's static scanner can find them. Sets & Reps has
// a fixed "reps" column (1fr) plus 0-3 narrow target columns (tempo/rir/rpe,
// coach-selected); Time-Based has 0-4 equal-width columns and no targets —
// indexed by count either way.
const GRID_COLS_SETS_REPS_BY_TARGET_COUNT = [
    "grid-cols-[24px_1fr_1fr]",                 // 0 targets
    "grid-cols-[24px_1fr_1fr_36px]",             // 1
    "grid-cols-[24px_1fr_1fr_36px_36px]",        // 2
    "grid-cols-[24px_1fr_1fr_36px_36px_36px]",   // 3 (tempo + rir + rpe)
];
const GRID_COLS_TIME_BASED_BY_COUNT = [
    "grid-cols-[24px_1fr]",             // 0: coach selected no metrics for this exercise (edge case)
    "grid-cols-[24px_1fr_1fr]",         // 1
    "grid-cols-[24px_1fr_1fr_1fr]",     // 2
    "grid-cols-[24px_1fr_1fr_1fr_1fr]", // 3
    "grid-cols-[24px_1fr_1fr_1fr_1fr_1fr]", // 4
];

export default function ClientTrainingPage() {
    const t      = useTranslations('portal.training');
    usePageTitle(t('title'));
    const locale = useLocale();
    const isRTL  = locale === 'ar';

    const [trainingPlan, setTrainingPlan]         = useState(null);
    const [loading, setLoading]                   = useState(true);
    const [noplan, setNoPlan]                     = useState(false);
    const [activeDayIndex, setActiveDayIndex]     = useState(0);
    const [previous, setPrevious]                 = useState({});
    const [insightsExercise, setInsightsExercise]     = useState(null);
    const [instructionsExercise, setInstructionsExercise] = useState(null);
    const [activeSession, setActiveSession]       = useState(null);
    const [now, setNow]                           = useState(() => Date.now());
    const [noteExpanded, setNoteExpanded]         = useState(false);
    const [dayNoteExpanded, setDayNoteExpanded]   = useState(false);
    const [isPageScrolled, setIsPageScrolled]     = useState(false);
    const [showLeftShadow, setShowLeftShadow]     = useState(false);
    const [showRightShadow, setShowRightShadow]   = useState(false);

    const tabsScrollRef = useRef(null);
    const router = useRouter();

    function updateTabShadows() {
        const el = tabsScrollRef.current;
        if (!el) return;
        setShowLeftShadow(el.scrollLeft > 0);
        setShowRightShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }

    useEffect(() => {
        const el = tabsScrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateTabShadows);
        const ro = new ResizeObserver(updateTabShadows);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', updateTabShadows); ro.disconnect(); };
    }, [trainingPlan]);

    useEffect(() => {
        api.get("/api/client-portal/active-training-plan")
            .then(res => setTrainingPlan(res.data))
            .catch(e => {
                if (e.response?.status === 404) setNoPlan(true);
                else {
                    const slug = localStorage.getItem('portal_slug');
                    router.push(slug ? `/portal/${slug}` : '/portal');
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    useEffect(() => {
        function handleScroll() { setIsPageScrolled(window.scrollY > 4); }
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Clears the bottom-nav Training dot — a plan is "seen" once this page has
    // loaded it, same as the mobile app (mobile/lib/features/training/training_page.dart).
    useEffect(() => {
        if (trainingPlan) setSeenPlanKey('training', planKey(trainingPlan.id, trainingPlan.activated_at));
    }, [trainingPlan]);

    // Picks up a session the client minimized back to this page instead of
    // finishing or discarding — re-checked whenever the plan loads or the
    // day tab changes, since Training Mode is a separate route/mount.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing an external store (localStorage) into React state, no async boundary to hook into
        setActiveSession(getActiveTrainingSession());
    }, [trainingPlan, activeDayIndex]);

    // Ticks the minimized-session timer, only while one is actually showing.
    useEffect(() => {
        if (!activeSession) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [activeSession]);

    // "Previous" column data for the active day — best-effort, same endpoint Training Mode uses.
    useEffect(() => {
        const dayId = trainingPlan?.days?.[activeDayIndex]?.id;
        if (!dayId) return;
        let cancelled = false;
        api.get("/api/client-portal/workout-logs/previous", { params: { day_id: dayId } })
            .then(({ data }) => { if (!cancelled) setPrevious(data ?? {}); })
            .catch(() => { if (!cancelled) setPrevious({}); });
        return () => { cancelled = true; };
    }, [trainingPlan, activeDayIndex]);

    function previousFor(exerciseId, setOrder, category) {
        const match = (previous[exerciseId] ?? []).find(p => p.set_order === setOrder);
        if (!match) return null;
        if (category === "sets_reps") {
            if (match.weight == null || match.reps == null) return null;
            return `${match.weight}kg × ${match.reps}`;
        }
        const parts = [];
        if (match.duration_seconds != null) parts.push(formatClock(match.duration_seconds));
        if (match.distance_km != null) parts.push(`${match.distance_km}km`);
        return parts.length > 0 ? parts.join(" · ") : null;
    }

    function switchDay(i) {
        setActiveDayIndex(i);
        setDayNoteExpanded(false);
    }

    function scrollTabsBack() {
        tabsScrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' });
    }
    function scrollTabsForward() {
        tabsScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' });
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
                <Skeleton className="h-8 w-48 rounded-lg mx-auto" />
                <Skeleton className="h-10 rounded-full w-64 mx-auto" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </div>
        );
    }

    const days      = trainingPlan?.days ?? [];
    const activeDay = days[activeDayIndex] ?? null;

    // A minimized session blocks starting any *other* day too — Training Mode
    // only tracks one in-progress workout at a time (single localStorage
    // slot), so the trigger always resumes the actual active session's day,
    // regardless of which day tab is currently selected.
    const sessionElapsedSeconds = activeSession
        ? Math.floor((now - new Date(activeSession.started_at).getTime()) / 1000)
        : 0;

    return (
        <div className="max-w-4xl mx-auto flex flex-col">

            {/* ── Sticky header ── */}
            <div className={`sticky top-14 z-30 bg-background px-6 pt-5 pb-4 flex flex-col gap-4 border-b transition-colors duration-200 ${isPageScrolled ? 'border-border' : 'border-transparent'}`}>
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-foreground text-start">
                        {trainingPlan ? trainingPlan.name : t('title')}
                    </h1>

                    {!noplan && trainingPlan && activeDay && (activeDay.exercises ?? []).length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                            <Link
                                href="/portal/training/history"
                                aria-label={t('history')}
                                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-default"
                            >
                                <History className="w-4 h-4" />
                            </Link>
                            <Link
                                href="/portal/training/progress"
                                aria-label={t('progress')}
                                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-default"
                            >
                                <LineChart className="w-4 h-4" />
                            </Link>
                        </div>
                    )}
                </div>

                {/* Day tabs */}
                {!noplan && trainingPlan && days.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                            {/* Back chevron */}
                            <button
                                onClick={isRTL ? scrollTabsForward : scrollTabsBack}
                                className={`shrink-0 p-1 rounded-full transition-opacity text-muted-foreground hover:text-foreground ${
                                    (isRTL ? showRightShadow : showLeftShadow) ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>

                            <div className="relative flex-1 min-w-0">
                                {/* Start shadow */}
                                <div
                                    className={`absolute inset-s-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 ${(isRTL ? showRightShadow : showLeftShadow) ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ background: `linear-gradient(to ${isRTL ? 'left' : 'right'}, var(--color-background), transparent)` }}
                                />
                                {/* End shadow */}
                                <div
                                    className={`absolute inset-e-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 ${(isRTL ? showLeftShadow : showRightShadow) ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ background: `linear-gradient(to ${isRTL ? 'right' : 'left'}, var(--color-background), transparent)` }}
                                />
                                {/* Force dir="ltr" for consistent scrollLeft */}
                                <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide pb-1 w-full" dir="ltr">
                                    <div className={`flex gap-2 w-max ${!showLeftShadow && !showRightShadow ? 'mx-auto' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        {days.map((day, i) => (
                                            <button
                                                key={day.id}
                                                onClick={() => switchDay(i)}
                                                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                                    activeDayIndex === i
                                                        ? "bg-primary border-primary text-primary-foreground"
                                                        : "border-border text-muted-foreground hover:bg-default"
                                                }`}
                                            >
                                                {day.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Forward chevron */}
                            <button
                                onClick={isRTL ? scrollTabsBack : scrollTabsForward}
                                className={`shrink-0 p-1 rounded-full transition-opacity text-muted-foreground hover:text-foreground ${
                                    (isRTL ? showLeftShadow : showRightShadow) ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Scrollable content ── */}
            <div className="px-6 pt-4 pb-6 flex flex-col gap-4">

                {noplan || !trainingPlan ? (
                    <Card>
                        <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                            <p className="text-base font-medium text-muted-foreground">{t('noActivePlan')}</p>
                            <p className="text-sm text-muted-foreground/70">{t('noActivePlanHint')}</p>
                        </Card.Content>
                    </Card>
                ) : (
                    <>
                        {/* Plan coach note — collapsible */}
                        {trainingPlan.notes && (
                            <div className="border border-yellow-500/40 overflow-hidden" style={{ borderRadius: 'min(32px, var(--radius-3xl))' }}>
                                <button
                                    onClick={() => setNoteExpanded(p => !p)}
                                    className="w-full flex items-start justify-between gap-3 px-4 py-3 cursor-pointer bg-yellow-500/10 hover:bg-yellow-500/15 transition-colors"
                                >
                                    <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                                        <span className="text-xs font-bold text-yellow-600 uppercase tracking-wide">{t('coachNote')}</span>
                                        {!noteExpanded && (
                                            <span dir="auto" className="text-xs text-yellow-600/70 truncate w-full">{trainingPlan.notes.split('\n')[0]}</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`shrink-0 mt-0.5 w-3.5 h-3.5 text-yellow-600 transition-transform duration-200 ${noteExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {noteExpanded && (
                                    <p dir="auto" className="text-sm text-yellow-600 whitespace-pre-wrap px-4 py-3 bg-yellow-500/5">{trainingPlan.notes}</p>
                                )}
                            </div>
                        )}

                        {/* Active day content */}
                        {activeDay && (
                            <>
                                {/* Day note — collapsible */}
                                {activeDay.notes && (
                                    <div className="border border-primary/30 overflow-hidden" style={{ borderRadius: 'min(32px, var(--radius-3xl))' }}>
                                        <button
                                            onClick={() => setDayNoteExpanded(p => !p)}
                                            className="w-full flex items-start justify-between gap-3 px-4 py-3 cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors"
                                        >
                                            <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                                                <span className="text-xs font-bold text-primary uppercase tracking-wide">{t('dayNote')}</span>
                                                {!dayNoteExpanded && (
                                                    <span dir="auto" className="text-xs text-primary/70 truncate w-full">{activeDay.notes.split('\n')[0]}</span>
                                                )}
                                            </div>
                                            <ChevronDown className={`shrink-0 mt-0.5 w-3.5 h-3.5 text-primary transition-transform duration-200 ${dayNoteExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        {dayNoteExpanded && (
                                            <p dir="auto" className="text-sm text-foreground whitespace-pre-wrap px-4 py-3 bg-primary/5">{activeDay.notes}</p>
                                        )}
                                    </div>
                                )}

                                {/* Exercises */}
                                {(activeDay.exercises ?? []).length === 0 ? (
                                    <Card>
                                        <Card.Content className="p-6 flex flex-col items-center justify-center py-12 gap-2 text-center">
                                            <svg className="w-8 h-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                                            </svg>
                                            <p className="text-base font-medium text-foreground">{activeDay.name}</p>
                                            <p className="text-sm text-muted-foreground">{t('restDayHint')}</p>
                                        </Card.Content>
                                    </Card>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {/* Exercises separator */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-border" />
                                            <span className="text-[11px] font-medium text-muted-foreground/50 tracking-widest uppercase">{t('exercises')}</span>
                                            <div className="flex-1 h-px bg-border" />
                                        </div>

                                        {(activeDay.exercises ?? []).map((exercise, exIdx) => {
                                            const category = categoryOf(exercise);
                                            // Column set is entirely the coach's choice (tracked_metrics) — not
                                            // whether a particular set happens to have a value. rest_seconds is
                                            // prescribed but never shown here (matches pre-existing behavior).
                                            const fields = prescribedFieldsFor(exercise).filter((f) => f !== "rest_seconds");
                                            const primaryFields = category === "sets_reps" ? fields.filter((f) => f === "reps") : fields;
                                            const targetFields  = category === "sets_reps" ? fields.filter((f) => f !== "reps") : [];
                                            const gridCols = category === "sets_reps"
                                                ? GRID_COLS_SETS_REPS_BY_TARGET_COUNT[targetFields.length]
                                                : GRID_COLS_TIME_BASED_BY_COUNT[primaryFields.length];
                                            return (
                                            <div key={exercise.id}>
                                                {exIdx > 0 && <div className="my-4 border-t border-border/50" />}

                                                {(exercise.youtube_url || exercise.video_path || exercise.thumbnail_path) && (
                                                    <div className="mb-3">
                                                        <ExerciseVideoPlayer
                                                            youtubeUrl={exercise.youtube_url}
                                                            videoPath={exercise.video_path}
                                                            thumbnailPath={exercise.thumbnail_path}
                                                            name={exercise.name}
                                                            watchLabel={t('watchVideo')}
                                                            watchOnYoutubeLabel={t('watchOnYoutube')}
                                                        />
                                                    </div>
                                                )}

                                                {/* Exercise header */}
                                                <div className="flex items-start gap-1">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                                                        {(exercise.muscle_group || exercise.equipment) && (
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                                {[exercise.muscle_group, exercise.equipment].filter(Boolean).map(part => (
                                                                    <Chip key={part} size="sm" variant="soft">{part}</Chip>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Tooltip>
                                                        <Button
                                                            isIconOnly
                                                            variant="ghost"
                                                            size="sm"
                                                            aria-label={t('progress')}
                                                            onClick={() => setInsightsExercise(exercise)}
                                                            className="shrink-0 text-muted-foreground"
                                                        >
                                                            <LineChart className="w-4 h-4" />
                                                        </Button>
                                                        <Tooltip.Content>{t('progress')}</Tooltip.Content>
                                                    </Tooltip>
                                                    <span title={t('instructions')}>
                                                        <NewFeatureTooltip
                                                            featureKey="exercise_instructions_hint"
                                                            active={exIdx === 0}
                                                            message={t('instructionsHint')}
                                                            dismissLabel={t('instructionsHintDismiss')}
                                                            badgeLabel={t('instructionsNewFeature')}
                                                            onTriggerClick={() => setInstructionsExercise(exercise)}
                                                            triggerClassName="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-default hover:text-foreground transition-colors cursor-pointer"
                                                        >
                                                            <BookOpen className="w-4 h-4" />
                                                        </NewFeatureTooltip>
                                                    </span>
                                                </div>

                                                {exercise.notes && (
                                                    <div className="border-s-2 border-amber-500/60 ps-3 mt-2">
                                                        <p dir="auto" className="text-xs text-muted-foreground whitespace-pre-wrap">{exercise.notes}</p>
                                                    </div>
                                                )}

                                                {/* Sets */}
                                                {(exercise.sets ?? []).length > 0 && (
                                                    <div className="flex flex-col mt-3">
                                                        <div className={`grid ${gridCols} gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 pb-1`}>
                                                            <span className="text-center truncate">{t('set')}</span>
                                                            <span className="text-center truncate">{t('previous')}</span>
                                                            {primaryFields.map((field) => (
                                                                <span key={field} className="text-center truncate">{t(FIELD_LABEL_KEY[field])}</span>
                                                            ))}
                                                            {targetFields.map((field) => (
                                                                <span key={field} className="text-center truncate">{t(FIELD_LABEL_KEY[field])}</span>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-col divide-y divide-border/30">
                                                            {exercise.sets.map((set, sIdx) => (
                                                                <div key={set.id} className={`grid ${gridCols} gap-1.5 items-center py-1.5`}>
                                                                    <span className="text-xs text-muted-foreground/60 text-center">{sIdx + 1}</span>
                                                                    <span className="text-[10px] text-muted-foreground/50 text-center truncate">{previousFor(exercise.id, set.set_order, category) ?? "—"}</span>
                                                                    {primaryFields.map((field) => (
                                                                        <span key={field} className="text-xs text-muted-foreground text-center truncate">{formatFieldValue(field, set[field])}</span>
                                                                    ))}
                                                                    {targetFields.map((field) => (
                                                                        <span key={field} className="text-xs text-muted-foreground text-center truncate">{hasTargetValue(field, set[field]) ? set[field] : "—"}</span>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Floating start-training trigger — visible when the active day has exercises.
                A minimized session takes over this slot on EVERY day tab (not just the
                one it belongs to), since only one session can be in progress at a time —
                it always resumes its own day, blocking a second one from being started. */}
            {!noplan && trainingPlan && (
                activeSession ? (
                    <div className="fixed left-1/2 -translate-x-1/2" style={{ bottom: '4.5rem', zIndex: 30 }}>
                        <NewFeatureTooltip
                            featureKey="resume_session_hint"
                            active
                            message={t('resumeSessionHint')}
                            dismissLabel={t('resumeSessionHintDismiss')}
                            badgeLabel={t('resumeSessionNewFeature')}
                            onTriggerClick={() => router.push(`/portal/training/session?day=${activeSession.day_index}`)}
                            triggerClassName="flex flex-col items-center gap-0.5 px-5 py-2 bg-primary text-primary-foreground rounded-2xl shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                        >
                            <span className="text-xs font-semibold leading-tight truncate max-w-40">{t('continueDay', { day: activeSession.day_name })}</span>
                            <span className="text-sm font-bold tabular-nums leading-tight">{formatDuration(sessionElapsedSeconds)}</span>
                        </NewFeatureTooltip>
                    </div>
                ) : (
                    activeDay && (activeDay.exercises ?? []).length > 0 && (
                        <Link
                            href={`/portal/training/session?day=${activeDayIndex}`}
                            className="fixed left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
                            style={{ bottom: '4.5rem', zIndex: 30 }}
                        >
                            <Play className="w-4 h-4" /> {t('startTraining')}
                        </Link>
                    )
                )
            )}

            <ClientExerciseInsightsModal
                open={!!insightsExercise}
                onClose={() => setInsightsExercise(null)}
                exercise={insightsExercise}
            />
            <ExerciseInstructionsModal
                open={!!instructionsExercise}
                onClose={() => setInstructionsExercise(null)}
                exercise={instructionsExercise}
            />
        </div>
    );
}
