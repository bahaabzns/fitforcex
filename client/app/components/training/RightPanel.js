import React, { useState } from "react";
import { useTranslations } from "next-intl";
import ExercisePickerModal from "@/app/components/training/ExercisePickerModal";
import { Button } from "@heroui/react/button";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";

const INPUT_CLASS = "h-8 w-full rounded-md border border-border px-2 text-xs focus:outline-none focus:border-primary/40";
function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : null;
}

const TrashIcon = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);

export default function RightPanel({
    selectedDay,
    handleAddExercise,
    handleAddMultipleExercises,
    handleDeleteExercise,
    handleRenameExercise,
    handleUpdateExerciseNotes,
    handleReorderExercises,
    handleRenameDay,
    handleAddSet,
    handleDuplicateSet,
    handleApplySetsToAll,
    handleDeleteSet,
    handleUpdateSetField,
    handleUpdateDayNotes,
    onClose,
}) {
    const t = useTranslations('training');
    const [showPicker, setShowPicker] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["exercises"]));
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [videoOpenId, setVideoOpenId] = useState(null);

    if (!selectedDay) {
        return (
            <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
                <p className="text-muted-foreground text-sm text-center flex items-center justify-center h-full">{t('selectDay')}</p>
            </Surface>
        );
    }

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 gap-4 shrink-0">
                <input
                    key={selectedDay.id}
                    type="text"
                    defaultValue={selectedDay.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || t('untitledDay');
                        e.target.value = trimmed;
                        if (trimmed !== selectedDay.name) handleRenameDay(selectedDay.id, trimmed);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") { e.target.value = selectedDay.name; e.target.blur(); }
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                />
                {onClose && (
                    <button
                        title={t('closePanel')}
                        onClick={onClose}
                        className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                )}
            </div>

            <ExercisePickerModal
                open={showPicker}
                onClose={() => setShowPicker(false)}
                onAddExercises={(items) => { handleAddMultipleExercises(selectedDay.id, items); setShowPicker(false); }}
            />

            <DisclosureGroup expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

                {/* Exercises section */}
                <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("exercises") ? "1 1 0" : "0 0 auto" }}>
                    <Disclosure id="exercises">
                        <Disclosure.Heading>
                            <div className="flex items-center gap-2 w-full my-3">
                                <Button
                                    slot="trigger"
                                    variant="ghost"
                                    className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
                                >
                                    <Disclosure.Indicator />
                                    <h3 className="text-base font-semibold text-foreground">
                                        {t('exercises')}
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedDay.exercises?.length ?? 0}</span>
                                    </h3>
                                </Button>
                                {expandedKeys.has("exercises") && (
                                    <Button variant="primary" onClick={() => setShowPicker(true)} className="shrink-0">
                                        {t('addExercise')}
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                    </Disclosure>
                    {expandedKeys.has("exercises") && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                <div className="flex flex-col gap-3">
                                    {(() => {
                                        const exercises = selectedDay.exercises ?? [];
                                        const preview = (() => {
                                            if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return exercises;
                                            const arr = [...exercises];
                                            const [moved] = arr.splice(dragIndex, 1);
                                            arr.splice(hoverIndex, 0, moved);
                                            return arr;
                                        })();
                                        return preview.map((exercise) => {
                                        const originalIndex = exercises.findIndex((e) => e.id === exercise.id);
                                        const isDragging = dragIndex !== null && exercises[dragIndex]?.id === exercise.id;
                                        const index = originalIndex;
                                        return (
                                        <div
                                            key={exercise.id}
                                            draggable
                                            onDragStart={() => setDragIndex(originalIndex)}
                                            onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                            onDrop={() => { handleReorderExercises(selectedDay.id, dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                            onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                            className={`group rounded-lg border border-border p-3 select-none transition-all ${isDragging ? "opacity-30 scale-95" : ""}`}
                                        >
                                            {/* Exercise header */}
                                            <div className="flex items-start gap-2 mb-2">
                                                {/* Thumbnail */}
                                                <div className="relative w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-muted-foreground overflow-hidden">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                    </svg>
                                                    {exercise.thumbnail_path && (
                                                        <img
                                                            src={exercise.thumbnail_path}
                                                            alt={exercise.name}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {/* Drag grip */}
                                                        <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0">
                                                            <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                                                <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                                                <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                                                <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                                            </svg>
                                                        </span>
                                                        <span className="text-xs font-semibold text-primary shrink-0">#{index + 1}</span>
                                                        <input
                                                            value={exercise.name}
                                                            onChange={(e) => handleRenameExercise(selectedDay.id, exercise.id, e.target.value)}
                                                            className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none min-w-0"
                                                        />
                                                        {exercise.exercise_library_id && (
                                                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold shrink-0">lib</span>
                                                        )}
                                                        {(exercise.youtube_url || exercise.video_path) && (
                                                            <button
                                                                onClick={() => setVideoOpenId(videoOpenId === exercise.id ? null : exercise.id)}
                                                                className={`shrink-0 p-1 rounded transition-colors cursor-pointer ${videoOpenId === exercise.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                                                                title={videoOpenId === exercise.id ? t('hideVideo') : t('watchVideo')}
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteExercise(selectedDay.id, exercise.id)}
                                                            className="shrink-0 p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                                            title={t('deleteExercise')}
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </div>
                                                    {exercise.muscle_group && (
                                                        <span className="text-[10px] text-muted-foreground ml-1">{exercise.muscle_group}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Inline video */}
                                            {videoOpenId === exercise.id && (exercise.youtube_url || exercise.video_path) && (
                                                <div className="mb-2 rounded-lg overflow-hidden bg-black aspect-video">
                                                    {getYoutubeEmbedUrl(exercise.youtube_url) ? (
                                                        <iframe
                                                            src={getYoutubeEmbedUrl(exercise.youtube_url)}
                                                            className="w-full h-full"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                        />
                                                    ) : (
                                                        <video src={`${SERVER}${exercise.video_path}`} controls className="w-full h-full" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Exercise notes */}
                                            <input
                                                value={exercise.notes ?? ""}
                                                onChange={(e) => handleUpdateExerciseNotes(selectedDay.id, exercise.id, e.target.value)}
                                                placeholder={t('exerciseNotes')}
                                                className="w-full mb-2 bg-transparent text-xs text-muted-foreground focus:outline-none placeholder:text-muted-foreground/40 border-b border-transparent focus:border-border"
                                            />

                                            {/* Sets header */}
                                            <div className="grid grid-cols-[20px_1fr_1fr_1fr_1fr_16px_16px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                                <span>#</span>
                                                <span>{t('reps')}</span>
                                                <span>{t('rest')}</span>
                                                <span>{t('tempo')}</span>
                                                <span>{t('rir')}</span>
                                                <span/><span/>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                {(exercise.sets ?? []).map((set, sIdx) => (
                                                    <div key={set.id} className="group/set grid grid-cols-[20px_1fr_1fr_1fr_1fr_16px_16px] gap-2 items-center">
                                                        <span className="text-xs text-muted-foreground">{sIdx + 1}</span>
                                                        <input value={set.reps ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "reps", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                                        <input value={set.rest_seconds ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rest_seconds", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                                        <input value={set.tempo ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "tempo", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                                        <input value={set.rir ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rir", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                                        <button
                                                            onClick={() => handleDuplicateSet(selectedDay.id, exercise.id, set.id)}
                                                            className="p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer opacity-0 group-hover/set:opacity-100"
                                                            title={t('duplicateSet')}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSet(selectedDay.id, exercise.id, set.id)}
                                                            className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer opacity-0 group-hover/set:opacity-100"
                                                            title={t('deleteSet')}
                                                        >
                                                            <TrashIcon size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-2 flex items-center gap-2">
                                                <Button size="sm" variant="primary" onClick={() => handleAddSet(selectedDay.id, exercise.id)}>
                                                    {t('addSet')}
                                                </Button>
                                                {(exercise.sets?.length ?? 0) > 0 && (selectedDay.exercises?.length ?? 0) > 1 && (
                                                    <Button size="sm" variant="outline" onClick={() => handleApplySetsToAll(selectedDay.id, exercise.id)}>
                                                        {t('applyToAll')}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                        });
                                    })()}

                                    {(selectedDay.exercises ?? []).length === 0 && (
                                        <Surface variant="default" className="rounded-xl p-8 flex items-center justify-center mx-2 my-2">
                                            <p className="text-sm text-muted-foreground">{t('noExercises')}</p>
                                        </Surface>
                                    )}
                                </div>
                    </ScrollShadow>
                    )}
                </div>

                <Separator className="my-2" />

                {/* Day Notes section */}
                <div className="flex flex-col shrink-0">
                    <Disclosure id="notes">
                        <Disclosure.Heading>
                            <Button
                                slot="trigger"
                                variant="ghost"
                                className="w-full justify-start gap-2 px-3 mb-2 data-hover:bg-transparent"
                            >
                                <Disclosure.Indicator />
                                <h3 className="text-base font-semibold text-foreground flex-1 text-left">{t('notes')}</h3>
                            </Button>
                        </Disclosure.Heading>
                        <Disclosure.Content>
                            <Disclosure.Body className="px-0 pt-0">
                                <textarea
                                    key={selectedDay.id + "-note"}
                                    defaultValue={selectedDay.notes ?? ""}
                                    placeholder={t('dayNotes')}
                                    rows={3}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val !== (selectedDay.notes ?? "")) handleUpdateDayNotes(selectedDay.id, val);
                                    }}
                                    className="w-full mb-2 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                />
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                </div>

            </DisclosureGroup>
        </Surface>
    );
}
