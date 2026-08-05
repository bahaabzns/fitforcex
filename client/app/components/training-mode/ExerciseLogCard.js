"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LineChart as ProgressIcon, BookOpen, NotebookPen, Check } from "lucide-react";
import { Chip } from "@heroui/react/chip";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import ExerciseVideoPlayer from "./ExerciseVideoPlayer";
import ExerciseNotesModal from "./ExerciseNotesModal";
import ExerciseInstructionsModal from "./ExerciseInstructionsModal";
import ClientExerciseInsightsModal from "./ClientExerciseInsightsModal";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import { hasTempoValue, hasRirValue, formatClock } from "@/utils/workout";
import { categoryOf, loggedFieldsFor, targetOnlyFieldsFor } from "@/utils/exerciseTrackingTypes";

// Precomputed Tailwind arbitrary-value grid templates — kept as whole literal
// strings (rather than built dynamically) so Tailwind's JIT scanner can find
// them. Every editable/previous column is "1fr"; read-only target columns
// (tempo/rir/rpe, Sets & Reps only) get a compact fixed width; 24px/28px for
// the set index/done tick. Sets & Reps has a fixed 2-column editable set
// (weight, reps) with 0-3 target columns depending on the coach's
// checklist; Time-Based has 0-4 editable columns and no targets.
const SET_ROW_COLS_SETS_REPS_BY_TARGET_COUNT = [
    "grid-cols-[24px_1fr_1fr_1fr_28px]",                     // 0 targets
    "grid-cols-[24px_1fr_1fr_1fr_36px_28px]",                // 1
    "grid-cols-[24px_1fr_1fr_1fr_36px_36px_28px]",           // 2
    "grid-cols-[24px_1fr_1fr_1fr_36px_36px_36px_28px]",      // 3 (tempo + rir + rpe)
];
const SET_ROW_COLS_TIME_BASED_BY_COUNT = [
    "grid-cols-[24px_1fr_28px]",             // 0: coach selected no metrics for this exercise (edge case)
    "grid-cols-[24px_1fr_1fr_28px]",         // 1
    "grid-cols-[24px_1fr_1fr_1fr_28px]",     // 2
    "grid-cols-[24px_1fr_1fr_1fr_1fr_28px]", // 3
    "grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_28px]", // 4
];

const FIELD_LABEL_KEY = {
    weight: "weight",
    reps: "repsShort",
    tempo: "tempo",
    rir: "rir",
    rpe: "rpe",
    duration_seconds: "duration",
    distance_km: "distance",
    incline_percent: "incline",
    speed_kmh: "speed",
};

function hasFieldValue(v) {
    return v !== null && v !== undefined && v !== "";
}

// rest_seconds is prescribed (a base field, always) but never a displayed
// column here — it drives the rest timer elsewhere in session/page.js, not
// a table cell. targetOnlyFieldsFor() doesn't know that distinction, so it's
// filtered out at the two call sites below.
function displayTargetFields(exercise) {
    return targetOnlyFieldsFor(exercise).filter((field) => field !== "rest_seconds");
}

// tempo's "not filled in" sentinel is the literal string "-" (see
// useTrainingPlan.js's defaultSetFor) — hasFieldValue alone would treat that
// as a real value. rir has its own similar historical helper; rpe has no
// sentinel, so hasFieldValue is exact for it.
function hasTargetValue(field, value) {
    if (field === "tempo") return hasTempoValue(value);
    if (field === "rir") return hasRirValue(value);
    return hasFieldValue(value);
}

// One exercise within a Training Mode session: a lazy video, per-set targets
// shown alongside each row, and an editable grid of logged sets (previous ·
// weight · reps · done). Flat, borderless layout — exercises are separated by
// the session list's own spacing/dividers rather than a card container, so
// the video, header and table read as one continuous section (matches the
// mobile app's Training Mode, which deliberately dropped card chrome here).
export default function ExerciseLogCard({ exercise, previous, focusSetIndex, isFirstExercise, onChangeSet, onToggleSet, onChangeNote }) {
    const t = useTranslations("portal.training");
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [instructionsOpen, setInstructionsOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const weightRefs = useRef([]);

    const prescribed = exercise.prescribed ?? [];
    const hasNote    = Boolean(exercise.note?.trim());
    const category   = categoryOf(exercise);
    // Column visibility is entirely the coach's choice now (tracked_metrics,
    // set in the exercise library) — not whether any particular set happens
    // to have a value yet. editableFields = what the client types in;
    // targetFields = read-only, from the coach's prescription (tempo/rir/rpe
    // for Sets & Reps only; Time-Based's metrics are editable, not targets).
    const editableFields = loggedFieldsFor(exercise);
    const targetFields   = displayTargetFields(exercise);
    const rowCols = category === "sets_reps"
        ? SET_ROW_COLS_SETS_REPS_BY_TARGET_COUNT[targetFields.length]
        : SET_ROW_COLS_TIME_BASED_BY_COUNT[editableFields.length];

    // Moves keyboard focus to the next set's weight field once the set before
    // it is marked done — lets a client log a whole exercise without reaching
    // for the mouse. Mirrors the mobile app's focusSetIndex behavior.
    useEffect(() => {
        if (focusSetIndex == null) return;
        weightRefs.current[focusSetIndex]?.focus();
    }, [focusSetIndex]);

    function previousFor(setOrder) {
        const match = (previous ?? []).find(p => p.set_order === setOrder);
        if (!match) return null;
        if (category === "sets_reps") {
            if (match.weight == null || match.reps == null) return null;
            return `${match.weight}kg × ${match.reps}`;
        }
        // time_based
        const parts = [];
        if (match.duration_seconds != null) parts.push(formatClock(match.duration_seconds));
        if (match.distance_km != null) parts.push(`${match.distance_km}km`);
        return parts.length > 0 ? parts.join(" · ") : null;
    }

    // Weight has no prescribed counterpart (training_sets never had a weight
    // column) — its placeholder stays "what you did last time". Every other
    // logged field IS something the coach set a target for on this set, so
    // showing that target as the placeholder tells the client what to aim
    // for, same as reps' targetReps below.
    function placeholderFor(field, setOrder, sIdx) {
        if (field === "weight") {
            const match = (previous ?? []).find(p => p.set_order === setOrder);
            return match?.weight != null ? `${match.weight}kg` : "kg";
        }
        const target = prescribed[sIdx]?.[field];
        if (!hasFieldValue(target)) return "—";
        if (field === "duration_seconds") return formatClock(target);
        if (field === "distance_km") return `${target}km`;
        if (field === "incline_percent") return `${target}%`;
        if (field === "speed_kmh") return `${target}km/h`;
        return String(target);
    }

    const metaParts = [exercise.muscle_group, exercise.equipment].filter(Boolean);

    return (
        <div className="flex flex-col">
            {(exercise.youtube_url || exercise.video_path || exercise.thumbnail_path) && (
                <div className="mb-3">
                    <ExerciseVideoPlayer
                        youtubeUrl={exercise.youtube_url}
                        videoPath={exercise.video_path}
                        thumbnailPath={exercise.thumbnail_path}
                        name={exercise.name}
                        watchLabel={t("watchVideo")}
                        watchOnYoutubeLabel={t("watchOnYoutube")}
                    />
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                    {metaParts.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {metaParts.map(part => (
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
                        aria-label={t("progress")}
                        onClick={() => setInsightsOpen(true)}
                        className="shrink-0 text-muted-foreground"
                    >
                        <ProgressIcon className="w-4 h-4" />
                    </Button>
                    <Tooltip.Content>{t("progress")}</Tooltip.Content>
                </Tooltip>
                <span title={t("instructions")}>
                    <NewFeatureTooltip
                        featureKey="exercise_instructions_hint"
                        active={!!isFirstExercise}
                        message={t("instructionsHint")}
                        dismissLabel={t("instructionsHintDismiss")}
                        badgeLabel={t("instructionsNewFeature")}
                        onTriggerClick={() => setInstructionsOpen(true)}
                        triggerClassName="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-default hover:text-foreground transition-colors cursor-pointer"
                    >
                        <BookOpen className="w-4 h-4" />
                    </NewFeatureTooltip>
                </span>
                <Tooltip>
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={t("notes")}
                        onClick={() => setNotesOpen(true)}
                        className={`shrink-0 ${hasNote ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <NotebookPen className="w-4 h-4" />
                    </Button>
                    <Tooltip.Content>{t("notes")}</Tooltip.Content>
                </Tooltip>
            </div>

            {exercise.notes && (
                <div className="border-s-2 border-amber-500/60 ps-3 mt-2">
                    <p dir="auto" className="text-xs text-muted-foreground whitespace-pre-wrap">{exercise.notes}</p>
                </div>
            )}

            {/* Sets */}
            <div className="flex flex-col mt-3">
                <div className={`grid ${rowCols} gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 pb-1`}>
                    <span className="text-center truncate">{t("set")}</span>
                    <span className="text-center truncate">{t("previous")}</span>
                    {editableFields.map((field) => (
                        <span key={field} className="text-center truncate">{t(FIELD_LABEL_KEY[field])}</span>
                    ))}
                    {targetFields.map((field) => (
                        <span key={field} className="text-center truncate">{t(FIELD_LABEL_KEY[field])}</span>
                    ))}
                    <Check className="w-3.5 h-3.5 mx-auto text-muted-foreground/50" />
                </div>

                <div className="flex flex-col divide-y divide-border/30">
                    {exercise.sets.map((set, sIdx) => {
                        const targetReps = prescribed[sIdx]?.reps ?? null;
                        return (
                            <div
                                key={sIdx}
                                className={`grid ${rowCols} gap-1.5 items-center py-1 rounded-lg transition-colors ${set.completed ? "bg-success/10" : ""}`}
                            >
                                <span className="text-xs text-muted-foreground/60 text-center">{sIdx + 1}</span>
                                <span className="text-[10px] text-muted-foreground/50 text-center truncate">{previousFor(set.set_order) ?? "—"}</span>

                                {editableFields.map((field, fIdx) => (
                                    <TextField key={field} value={set[field] ?? ""} onChange={(v) => onChangeSet(sIdx, field, v)} aria-label={t(FIELD_LABEL_KEY[field])} variant="secondary" fullWidth>
                                        <Input
                                            ref={fIdx === 0 ? (el) => { weightRefs.current[sIdx] = el; } : undefined}
                                            inputMode={field === "reps" || field === "duration_seconds" ? "numeric" : "decimal"}
                                            placeholder={field === "reps" ? (targetReps ?? "—") : placeholderFor(field, set.set_order, sIdx)}
                                            className={`text-center px-1 py-1 text-xs ${set.completed ? "border-transparent bg-transparent shadow-none" : ""}`}
                                        />
                                    </TextField>
                                ))}

                                {targetFields.map((field) => {
                                    const raw = prescribed[sIdx]?.[field];
                                    return (
                                        <span key={field} className="text-xs text-muted-foreground text-center truncate">
                                            {hasTargetValue(field, raw) ? raw : "—"}
                                        </span>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => onToggleSet(sIdx)}
                                    aria-label={t("markDone")}
                                    aria-pressed={set.completed}
                                    className={`mx-auto flex items-center justify-center w-7 h-7 rounded-lg border-2 transition-colors cursor-pointer ${
                                        set.completed ? "bg-success border-success text-white" : "border-muted-foreground/40 text-transparent hover:border-muted-foreground/70"
                                    }`}
                                >
                                    <Check className="w-4 h-4" strokeWidth={2.5} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <ClientExerciseInsightsModal
                open={insightsOpen}
                onClose={() => setInsightsOpen(false)}
                exercise={exercise}
            />
            <ExerciseInstructionsModal
                open={instructionsOpen}
                onClose={() => setInstructionsOpen(false)}
                exercise={exercise}
            />
            <ExerciseNotesModal
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                initialValue={exercise.note}
                onSave={onChangeNote}
                exercise={exercise}
            />
        </div>
    );
}
