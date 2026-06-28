"use client";

import { useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";

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

    const secondaryParts = [exercise.muscle_group, `${exercise.sets.length} ${t("setsShort")}`].filter(Boolean);

    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">

            {/* Header */}
            <div className="px-3 py-2 flex items-center gap-2 select-none">

                {/* Drag handle */}
                <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0">
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                        <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                        <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                    </svg>
                </span>

                {/* Thumbnail */}
                <div className="relative w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                    <span className="text-xs font-bold text-primary">#{index + 1}</span>
                    {exercise.thumbnail_path && (
                        <img
                            src={exercise.thumbnail_path}
                            alt={exercise.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                    )}
                </div>

                {/* Name + secondary */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">{exercise.name}</p>
                    {secondaryParts.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {secondaryParts.join(" · ")}
                        </p>
                    )}
                </div>

                {/* Target guidance — MacroStat-style columns, visible only when prescribed */}
                {guidance && (
                    <div className="flex items-center gap-2 shrink-0">
                        {guidance.reps && (
                            <div className="flex flex-col items-center gap-0.5 w-12 shrink-0">
                                <span className="text-[11px] font-medium leading-none text-muted-foreground">{t("target")}</span>
                                <span className="text-xs text-muted-foreground">
                                    <span className="text-foreground">{guidance.reps}</span> {t("repsShort")}
                                </span>
                            </div>
                        )}
                        {guidance.rest_seconds != null && (
                            <div className="flex flex-col items-center gap-0.5 w-12 shrink-0">
                                <span className="text-[11px] font-medium leading-none text-muted-foreground">{t("rest")}</span>
                                <span className="text-sm font-bold text-foreground">{guidance.rest_seconds}s</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions — fixed footprint matching the food-item row's trailing slot */}
                <div className="w-6 shrink-0" />

            </div>

            {/* Notes */}
            <div className="px-4 py-2.5 border-t border-border/50">
                <input
                    value={exercise.note}
                    onChange={(e) => onChangeNote(e.target.value)}
                    placeholder={t("exerciseNotePlaceholder")}
                    dir="auto"
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary outline-none"
                />
            </div>

            {/* Sets Table */}
            <div className="px-3 pt-2 pb-1 border-t border-border/40">
                <div className="grid grid-cols-[22px_minmax(40px,1fr)_1fr_1.3fr_0.75fr_26px] gap-1.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40 mb-0.5 items-center px-1">
                    <span>{t("set")}</span>
                    <span>{t("previous")}</span>
                    <span>{t("weight")}</span>
                    <span>{t("repsShort")}</span>
                    <span>{t("rir")}</span>
                    <span />
                </div>

                <div className="flex flex-col divide-y divide-border/20">
                    {exercise.sets.map((set, sIdx) => (
                        <div
                            key={sIdx}
                            className={`grid grid-cols-[22px_minmax(40px,1fr)_1fr_1.3fr_0.75fr_26px] gap-1.5 items-center py-1 px-1 ${set.completed ? "bg-green-500/10" : ""}`}
                        >
                            <span className="text-[11px] text-muted-foreground/60">{sIdx + 1}</span>
                            <span className="text-[11px] text-muted-foreground/50 truncate">{previousFor(set.set_order) ?? "—"}</span>

                            <input
                                inputMode="decimal"
                                value={set.weight}
                                onChange={(e) => onChangeSet(sIdx, "weight", e.target.value)}
                                placeholder="kg"
                                className="w-full rounded border border-border/40 bg-transparent px-1.5 py-0.5 text-xs text-center text-foreground hover:border-border/70 focus:border-primary focus:bg-muted/30 outline-none transition-colors"
                            />
                            <input
                                inputMode="numeric"
                                value={set.reps}
                                onChange={(e) => onChangeSet(sIdx, "reps", e.target.value)}
                                placeholder="—"
                                className="w-full rounded border border-border/40 bg-transparent px-1.5 py-0.5 text-xs text-center text-foreground hover:border-border/70 focus:border-primary focus:bg-muted/30 outline-none transition-colors"
                            />
                            <input
                                inputMode="numeric"
                                value={set.rir}
                                onChange={(e) => onChangeSet(sIdx, "rir", e.target.value)}
                                placeholder="—"
                                className="w-full rounded border border-border/40 bg-transparent px-1.5 py-0.5 text-xs text-center text-foreground hover:border-border/70 focus:border-primary focus:bg-muted/30 outline-none transition-colors"
                            />

                            <div className="flex items-center justify-center">
                                <button
                                    onClick={() => onToggleSet(sIdx)}
                                    aria-label={t("markDone")}
                                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                                        set.completed
                                            ? "bg-green-500 border-green-500 text-white"
                                            : "border-border/40 text-muted-foreground/40 hover:border-green-500 hover:text-green-600"
                                    }`}
                                >
                                    <Check className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-4 pb-3 pt-1.5 flex items-center gap-3">
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
    );
}
