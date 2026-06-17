"use client";

import { useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";

// One exercise within a Training Mode session: prescribed targets shown faintly
// as guidance, plus an editable grid of logged sets (weight / reps / RIR / done)
// with a "previous" column from the client's last session.
export default function ExerciseLogCard({ exercise, previous, index, onChangeSet, onToggleSet, onAddSet, onRemoveSet, onChangeNote }) {
    const t = useTranslations("portal.training");

    const prescribed = exercise.prescribed ?? [];
    const guidance   = prescribed[0] ?? null;

    function previousFor(setOrder) {
        const match = (previous ?? []).find(p => p.set_order === setOrder);
        if (!match || match.weight == null || match.reps == null) return null;
        return `${match.weight}×${match.reps}`;
    }

    return (
        <Card>
            <Card.Content className="px-4 py-3 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                    <div className="relative w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-muted-foreground/40 overflow-hidden">
                        <span className="text-sm font-bold text-primary">#{index + 1}</span>
                        {exercise.thumbnail_path && (
                            <img
                                src={exercise.thumbnail_path}
                                alt={exercise.name}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-foreground">{exercise.name}</span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {exercise.muscle_group && <Chip size="sm" className="bg-secondary text-foreground">{exercise.muscle_group}</Chip>}
                            {exercise.equipment && <Chip size="sm" className="bg-violet-500/15 text-violet-600">{exercise.equipment}</Chip>}
                            {guidance && (
                                <span className="text-[11px] text-muted-foreground">
                                    {t("target")}: {guidance.reps || "—"} {t("repsShort")}
                                    {guidance.rest_seconds != null ? ` · ${guidance.rest_seconds}s ${t("rest").toLowerCase()}` : ""}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sets grid */}
                <div>
                    <div className="grid grid-cols-[28px_minmax(48px,1fr)_1fr_1fr_1fr_36px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1 items-center">
                        <span>{t("set")}</span>
                        <span>{t("previous")}</span>
                        <span>{t("weight")}</span>
                        <span>{t("repsShort")}</span>
                        <span>{t("rir")}</span>
                        <span />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {exercise.sets.map((set, sIdx) => (
                            <div
                                key={sIdx}
                                className={`grid grid-cols-[28px_minmax(48px,1fr)_1fr_1fr_1fr_36px] gap-2 items-center rounded-lg py-1 ${set.completed ? "bg-green-500/10" : ""}`}
                            >
                                <span className="text-xs text-muted-foreground ps-1">{sIdx + 1}</span>
                                <span className="text-xs text-muted-foreground/70 truncate">{previousFor(set.set_order) ?? "—"}</span>

                                <input
                                    inputMode="decimal"
                                    value={set.weight}
                                    onChange={(e) => onChangeSet(sIdx, "weight", e.target.value)}
                                    placeholder="kg"
                                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-center text-foreground focus:border-primary outline-none"
                                />
                                <input
                                    inputMode="numeric"
                                    value={set.reps}
                                    onChange={(e) => onChangeSet(sIdx, "reps", e.target.value)}
                                    placeholder="—"
                                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-center text-foreground focus:border-primary outline-none"
                                />
                                <input
                                    inputMode="numeric"
                                    value={set.rir}
                                    onChange={(e) => onChangeSet(sIdx, "rir", e.target.value)}
                                    placeholder="—"
                                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-center text-foreground focus:border-primary outline-none"
                                />

                                <div className="flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => onToggleSet(sIdx)}
                                        aria-label={t("markDone")}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                                            set.completed
                                                ? "bg-green-500 border-green-500 text-white"
                                                : "border-border text-muted-foreground hover:border-green-500 hover:text-green-600"
                                        }`}
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <button
                            onClick={onAddSet}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" /> {t("addSet")}
                        </button>
                        {exercise.sets.length > 1 && (
                            <button
                                onClick={() => onRemoveSet(exercise.sets.length - 1)}
                                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-red-500 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" /> {t("removeSet")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Per-exercise note */}
                <input
                    value={exercise.note}
                    onChange={(e) => onChangeNote(e.target.value)}
                    placeholder={t("exerciseNotePlaceholder")}
                    dir="auto"
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary outline-none"
                />
            </Card.Content>
        </Card>
    );
}
