import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import ExercisePickerModal from "@/app/components/training/ExercisePickerModal";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { TextArea } from "@heroui/react/textarea";
import { Table } from "@heroui/react/table";
import { Disclosure, DisclosureGroup, Separator, Surface, Text } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import InlineEditField from "@/app/components/InlineEditField";

const SET_INPUT_CLASS = "h-8 px-2 py-0 text-xs text-center shadow-none w-full";
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
const DumbbellIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11"/>
    </svg>
);
const ChevronIcon = ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
    </svg>
);
const PlayIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
    </svg>
);

export default function RightPanel({
    selectedDay,
    handleAddExercise,
    handleAddMultipleExercises,
    handleDeleteExercise,
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
    const locale = useLocale();
    const [showPicker, setShowPicker] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["exercises"]));
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [videoOpenId, setVideoOpenId] = useState(null);
    const [expandedExerciseIds, setExpandedExerciseIds] = useState(() => new Set());

    const toggleExercise = (id) => setExpandedExerciseIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    if (!selectedDay) {
        return (
            <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-[min(32px,var(--radius-3xl))]">
                <p className="text-muted-foreground text-sm text-center flex items-center justify-center h-full">{t('selectDay')}</p>
            </Surface>
        );
    }

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-[min(32px,var(--radius-3xl))]">
            {/* Header */}
            <div className="flex justify-between items-center mb-2 gap-3 shrink-0">
                <InlineEditField
                    key={selectedDay.id}
                    value={selectedDay.name}
                    fallback={t('untitledDay')}
                    onCommit={(name) => handleRenameDay(selectedDay.id, name)}
                    ariaLabel="Day name"
                    variant="primary"
                    className="flex-1 min-w-0"
                    inputClassName="font-semibold shadow-none"
                />
                {onClose && (
                    <button
                        title={t('closePanel')}
                        onClick={onClose}
                        className="cursor-pointer p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
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
                            <div className="flex items-center gap-2 w-full my-2">
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
                                    <Button variant="outline" onClick={() => setShowPicker(true)} className="shrink-0">
                                        {t('addExercise')}
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                    </Disclosure>
                    {expandedKeys.has("exercises") && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                <div className="flex flex-col gap-1">
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
                                        // Name is defined by the linked library exercise — show it read-only.
                                        const exerciseName = getLocalizedField(exercise, "library_name", locale) || exercise.name || "";
                                        const setCount = exercise.sets?.length ?? 0;
                                        const isExpanded = expandedExerciseIds.has(exercise.id);
                                        const hasVideo = exercise.youtube_url || exercise.video_path;
                                        return (
                                        <div
                                            key={exercise.id}
                                            draggable
                                            onDragStart={() => setDragIndex(originalIndex)}
                                            onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                            onDrop={() => { handleReorderExercises(selectedDay.id, dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                            onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                            className={`group rounded-lg select-none transition-colors ${isDragging ? "opacity-40" : ""} ${isExpanded ? "bg-default/40" : "hover:bg-default"}`}
                                        >
                                            {/* Exercise header row */}
                                            <div onClick={() => toggleExercise(exercise.id)} className="flex items-center gap-3 px-2.5 py-2 cursor-pointer">
                                                <div className="relative shrink-0 w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted overflow-hidden cursor-grab">
                                                    <DumbbellIcon />
                                                    {exercise.thumbnail_path && (
                                                        <img
                                                            src={exercise.thumbnail_path}
                                                            alt={exerciseName}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Text type="body-xs" weight="semibold" className="text-primary shrink-0">#{index + 1}</Text>
                                                        <Text type="body-sm" weight="semibold" truncate className="flex-1 min-w-0" title={exerciseName}>
                                                            {exerciseName}
                                                        </Text>
                                                        {exercise.exercise_library_id && (
                                                            <Text type="body-xs" weight="semibold" title="From library" className="bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">lib</Text>
                                                        )}
                                                    </div>
                                                    <Text type="body-xs" color="muted" truncate>
                                                        {exercise.muscle_group ? `${exercise.muscle_group} · ` : ""}{setCount} sets
                                                    </Text>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteExercise(selectedDay.id, exercise.id); }}
                                                        className="p-1 rounded text-muted hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer opacity-60 group-hover:opacity-100"
                                                        title={t('deleteExercise')}
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                    <ChevronIcon className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                </div>
                                            </div>

                                            {isExpanded && (
                                            <div className="px-3 pb-3 flex flex-col gap-2">
                                                {hasVideo && (
                                                    <button
                                                        onClick={() => setVideoOpenId(videoOpenId === exercise.id ? null : exercise.id)}
                                                        className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer w-fit"
                                                    >
                                                        <PlayIcon /> {videoOpenId === exercise.id ? t('hideVideo') : t('watchVideo')}
                                                    </button>
                                                )}

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
                                            <TextField
                                                value={exercise.notes ?? ""}
                                                onChange={(val) => handleUpdateExerciseNotes(selectedDay.id, exercise.id, val)}
                                                aria-label={t('exerciseNotes')}
                                                className="w-full mb-2"
                                            >
                                                <Input variant="secondary" placeholder={t('exerciseNotes')} className="h-8 px-2 py-0 text-xs shadow-none" />
                                            </TextField>

                                            {/* Sets table */}
                                            <Table variant="primary" aria-label="Sets" className="mb-1">
                                                <Table.ScrollContainer>
                                                    <Table.Content aria-label="Sets">
                                                        <Table.Header>
                                                            <Table.Column isRowHeader className="w-8 px-2">#</Table.Column>
                                                            <Table.Column className="px-1">{t('reps')}</Table.Column>
                                                            <Table.Column className="px-1">{t('rest')}</Table.Column>
                                                            <Table.Column className="px-1">{t('tempo')}</Table.Column>
                                                            <Table.Column className="px-1">{t('rir')}</Table.Column>
                                                            <Table.Column className="w-12 px-2 text-end"><span className="sr-only">Actions</span></Table.Column>
                                                        </Table.Header>
                                                        <Table.Body>
                                                            {(exercise.sets ?? []).map((set, sIdx) => (
                                                                <Table.Row key={set.id} id={set.id} className="group/set">
                                                                    <Table.Cell className="px-2 text-xs text-muted">{sIdx + 1}</Table.Cell>
                                                                    <Table.Cell className="px-1">
                                                                        <TextField className="min-w-0" value={String(set.reps ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "reps", val)} aria-label={t('reps')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="px-1">
                                                                        <TextField className="min-w-0" value={String(set.rest_seconds ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rest_seconds", val)} aria-label={t('rest')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="px-1">
                                                                        <TextField className="min-w-0" value={String(set.tempo ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "tempo", val)} aria-label={t('tempo')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="px-1">
                                                                        <TextField className="min-w-0" value={String(set.rir ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rir", val)} aria-label={t('rir')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="px-1">
                                                                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover/set:opacity-100 focus-within:opacity-100">
                                                                            <button
                                                                                onClick={() => handleDuplicateSet(selectedDay.id, exercise.id, set.id)}
                                                                                className="p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                                                title={t('duplicateSet')}
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteSet(selectedDay.id, exercise.id, set.id)}
                                                                                className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                                                                title={t('deleteSet')}
                                                                            >
                                                                                <TrashIcon size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </Table.Cell>
                                                                </Table.Row>
                                                            ))}
                                                        </Table.Body>
                                                    </Table.Content>
                                                </Table.ScrollContainer>
                                            </Table>

                                            <div className="mt-2 flex items-center gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleAddSet(selectedDay.id, exercise.id)}>
                                                    {t('addSet')}
                                                </Button>
                                                {(exercise.sets?.length ?? 0) > 0 && (selectedDay.exercises?.length ?? 0) > 1 && (
                                                    <Button size="sm" variant="outline" onClick={() => handleApplySetsToAll(selectedDay.id, exercise.id)}>
                                                        {t('applyToAll')}
                                                    </Button>
                                                )}
                                            </div>
                                            </div>
                                            )}
                                        </div>
                                        );
                                        });
                                    })()}

                                    {(selectedDay.exercises ?? []).length === 0 && (
                                        <Surface variant="default" className="rounded-xl p-6 flex items-center justify-center mx-2 my-2">
                                            <Text type="body-sm" color="muted">{t('noExercises')}</Text>
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
                                <TextArea
                                    key={selectedDay.id + "-note"}
                                    defaultValue={selectedDay.notes ?? ""}
                                    placeholder={t('dayNotes')}
                                    rows={3}
                                    fullWidth
                                    variant="secondary"
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val !== (selectedDay.notes ?? "")) handleUpdateDayNotes(selectedDay.id, val);
                                    }}
                                    className="mb-2 resize-none"
                                />
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                </div>

            </DisclosureGroup>
        </Surface>
    );
}
