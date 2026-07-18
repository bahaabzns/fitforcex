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
import CoachNoteModal from "./CoachNoteModal";
import ClientExerciseInsightsModal from "./ClientExerciseInsightsModal";

const SET_ROW_COLS = "grid-cols-[24px_1fr_1fr_1fr_32px_28px]";

// One exercise within a Training Mode session: a lazy video, per-set targets
// shown alongside each row, and an editable grid of logged sets (previous ·
// weight · reps · done). Flat, borderless layout — exercises are separated by
// the session list's own spacing/dividers rather than a card container, so
// the video, header and table read as one continuous section (matches the
// mobile app's Training Mode, which deliberately dropped card chrome here).
export default function ExerciseLogCard({ exercise, previous, focusSetIndex, onChangeSet, onToggleSet, onChangeNote }) {
    const t = useTranslations("portal.training");
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [coachNoteOpen, setCoachNoteOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const weightRefs = useRef([]);

    const prescribed = exercise.prescribed ?? [];
    const hasNote = Boolean(exercise.note?.trim());

    // Moves keyboard focus to the next set's weight field once the set before
    // it is marked done — lets a client log a whole exercise without reaching
    // for the mouse. Mirrors the mobile app's focusSetIndex behavior.
    useEffect(() => {
        if (focusSetIndex == null) return;
        weightRefs.current[focusSetIndex]?.focus();
    }, [focusSetIndex]);

    function previousFor(setOrder) {
        const match = (previous ?? []).find(p => p.set_order === setOrder);
        if (!match || match.weight == null || match.reps == null) return null;
        return `${match.weight}kg × ${match.reps}`;
    }

    function weightPlaceholder(setOrder) {
        const match = (previous ?? []).find(p => p.set_order === setOrder);
        return match?.weight != null ? `${match.weight}kg` : "kg";
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
                <Tooltip>
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={t("coachNote")}
                        onClick={() => setCoachNoteOpen(true)}
                        className="shrink-0 text-muted-foreground"
                    >
                        <BookOpen className="w-4 h-4" />
                    </Button>
                    <Tooltip.Content>{t("coachNote")}</Tooltip.Content>
                </Tooltip>
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

            {/* Sets */}
            <div className="flex flex-col mt-3">
                <div className={`grid ${SET_ROW_COLS} gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 pb-1`}>
                    <span className="text-center truncate">{t("set")}</span>
                    <span className="text-center truncate">{t("previous")}</span>
                    <span className="text-center truncate">{t("weight")}</span>
                    <span className="text-center truncate">{t("repsShort")}</span>
                    <span className="text-center truncate">{t("rir")}</span>
                    <Check className="w-3.5 h-3.5 mx-auto text-muted-foreground/50" />
                </div>

                <div className="flex flex-col divide-y divide-border/30">
                    {exercise.sets.map((set, sIdx) => {
                        const targetReps = prescribed[sIdx]?.reps ?? null;
                        const targetRir  = prescribed[sIdx]?.rir ?? null;
                        return (
                            <div
                                key={sIdx}
                                className={`grid ${SET_ROW_COLS} gap-1.5 items-center py-1 rounded-lg transition-colors ${set.completed ? "bg-success/10" : ""}`}
                            >
                                <span className="text-xs text-muted-foreground/60 text-center">{sIdx + 1}</span>
                                <span className="text-[10px] text-muted-foreground/50 text-center truncate">{previousFor(set.set_order) ?? "—"}</span>

                                <TextField value={set.weight} onChange={(v) => onChangeSet(sIdx, "weight", v)} aria-label={t("weight")} variant="secondary" fullWidth>
                                    <Input
                                        ref={(el) => { weightRefs.current[sIdx] = el; }}
                                        inputMode="decimal"
                                        placeholder={weightPlaceholder(set.set_order)}
                                        className={`text-center px-1 py-1 text-xs ${set.completed ? "border-transparent bg-transparent shadow-none" : ""}`}
                                    />
                                </TextField>
                                <TextField value={set.reps} onChange={(v) => onChangeSet(sIdx, "reps", v)} aria-label={t("repsShort")} variant="secondary" fullWidth>
                                    <Input
                                        inputMode="numeric"
                                        placeholder={targetReps ?? "—"}
                                        className={`text-center px-1 py-1 text-xs ${set.completed ? "border-transparent bg-transparent shadow-none" : ""}`}
                                    />
                                </TextField>

                                <span className="text-xs text-muted-foreground text-center">{targetRir ?? "—"}</span>

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
            <CoachNoteModal
                open={coachNoteOpen}
                onClose={() => setCoachNoteOpen(false)}
                exercise={exercise}
            />
            <ExerciseNotesModal
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                initialValue={exercise.note}
                onSave={onChangeNote}
            />
        </div>
    );
}
