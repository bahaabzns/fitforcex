"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LineChart as ProgressIcon, NotebookPen } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Checkbox } from "@heroui/react/checkbox";
import ExerciseVideoPlayer from "./ExerciseVideoPlayer";
import ExerciseNotesModal from "./ExerciseNotesModal";
import ClientExerciseInsightsModal from "./ClientExerciseInsightsModal";

const SET_ROW_COLS = "grid-cols-[20px_38px_1fr_1fr_34px_42px_28px]";

// One exercise within a Training Mode session: a full-width video, an editable
// grid of logged sets (weight / reps / done) with read-only per-set target
// reps/RIR/rest and a "previous" column from the client's last session. The
// client logs the assigned workout only — set structure is fixed by the
// coach's plan, and notes/progress live behind icon actions to keep the card
// compact.
export default function ExerciseLogCard({ exercise, previous, onChangeSet, onToggleSet, onChangeNote }) {
    const t = useTranslations("portal.training");
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);

    const prescribed = exercise.prescribed ?? [];

    function previousFor(setOrder) {
        const match = (previous ?? []).find(p => p.set_order === setOrder);
        if (!match || match.weight == null || match.reps == null) return null;
        return `${match.weight}×${match.reps}`;
    }

    const metaParts = [exercise.muscle_group, exercise.equipment].filter(Boolean);
    const hasNote = Boolean(exercise.note?.trim());

    return (
        <Card className="p-0 gap-0">

            <ExerciseVideoPlayer
                youtubeUrl={exercise.youtube_url}
                videoPath={exercise.video_path}
                thumbnailPath={exercise.thumbnail_path}
                name={exercise.name}
                watchLabel={t("watchVideo")}
            />

            {/* Header */}
            <Card.Header className="gap-1.5 px-3 py-2.5">
                <div className="flex items-center gap-1">
                    <p className="flex-1 min-w-0 text-base font-bold truncate text-foreground">{exercise.name}</p>
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
                            aria-label={t("notes")}
                            onClick={() => setNotesOpen(true)}
                            className={`shrink-0 ${hasNote ? "text-primary" : "text-muted-foreground"}`}
                        >
                            <NotebookPen className="w-4 h-4" />
                        </Button>
                        <Tooltip.Content>{t("notes")}</Tooltip.Content>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {metaParts.map(part => (
                        <Chip key={part} size="sm" variant="soft">{part}</Chip>
                    ))}
                    <span className="text-xs text-muted-foreground">{exercise.sets.length} {t("setsShort")}</span>
                </div>
            </Card.Header>

            <Separator />

            <Card.Content className="p-0 flex flex-col">

                {/* Sets */}
                <div className="flex flex-col">
                    <div className={`grid ${SET_ROW_COLS} gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50 px-3 py-1.5 border-b border-border/20`}>
                        <span className="text-center truncate">{t("set")}</span>
                        <span className="text-center truncate">{t("previous")}</span>
                        <span className="text-center truncate">{t("weight")}</span>
                        <span className="text-center truncate">{t("repsShort")}</span>
                        <span className="text-center truncate">{t("rir")}</span>
                        <span className="text-center truncate">{t("rest")}</span>
                        <span />
                    </div>

                    <div className="flex flex-col divide-y divide-border/30">
                        {exercise.sets.map((set, sIdx) => {
                            const targetReps = prescribed[sIdx]?.reps ?? null;
                            const targetRir  = prescribed[sIdx]?.rir ?? null;
                            const targetRest = prescribed[sIdx]?.rest_seconds ?? null;
                            return (
                                <div
                                    key={sIdx}
                                    className={`grid ${SET_ROW_COLS} gap-1.5 items-center px-3 py-2 transition-colors ${set.completed ? "bg-success/10" : ""}`}
                                >
                                    <span className="text-xs text-muted-foreground/60 text-center">{sIdx + 1}</span>
                                    <span className="text-xs text-muted-foreground/50 text-center truncate">{previousFor(set.set_order) ?? "—"}</span>

                                    <TextField value={set.weight} onChange={(v) => onChangeSet(sIdx, "weight", v)} aria-label={t("weight")} variant="secondary" fullWidth>
                                        <Input inputMode="decimal" placeholder="kg" className="text-center px-1 py-1 text-xs" />
                                    </TextField>
                                    <TextField value={set.reps} onChange={(v) => onChangeSet(sIdx, "reps", v)} aria-label={t("repsShort")} variant="secondary" fullWidth>
                                        <Input inputMode="numeric" placeholder={targetReps ?? "—"} className="text-center px-1 py-1 text-xs" />
                                    </TextField>

                                    <span className="text-xs text-muted-foreground text-center">{targetRir ?? "—"}</span>
                                    <span className="text-xs text-muted-foreground text-center">{targetRest != null ? `${targetRest}s` : "—"}</span>

                                    <div className="flex items-center justify-center">
                                        <Checkbox isSelected={set.completed} onChange={() => onToggleSet(sIdx)} aria-label={t("markDone")} variant="secondary">
                                            <Checkbox.Control className="border-2 border-muted-foreground/40 data-[selected=true]:border-transparent">
                                                <Checkbox.Indicator />
                                            </Checkbox.Control>
                                        </Checkbox>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card.Content>

            <ClientExerciseInsightsModal
                open={insightsOpen}
                onClose={() => setInsightsOpen(false)}
                exercise={exercise}
            />
            <ExerciseNotesModal
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                initialValue={exercise.note}
                onSave={onChangeNote}
            />
        </Card>
    );
}
