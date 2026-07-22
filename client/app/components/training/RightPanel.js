import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import ExercisePickerModal from "@/app/components/training/ExercisePickerModal";
import ExerciseInsightsModal from "@/app/components/training/ExerciseInsightsModal";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { TextArea } from "@heroui/react/textarea";
import { Table } from "@heroui/react/table";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import { Modal } from "@heroui/react/modal";
import InlineEditField from "@/app/components/InlineEditField";
import Typography from "@/app/components/Typography";
import { SortableList, SortableItem } from "@/app/components/SortableList";

const SET_INPUT_CLASS = "h-6 px-1.5 py-0 text-sm font-semibold text-center shadow-none w-full !rounded";

function handleSetInputTab(e) {
    if (e.key === 'Enter') { e.target.blur(); return; }
    if (e.key !== 'Tab') return;
    const table = e.target.closest('.table__content');
    if (!table) return;
    e.preventDefault();
    e.stopPropagation();
    const inputs = Array.from(table.querySelectorAll('input'));
    const idx = inputs.indexOf(e.target);
    const next = inputs[e.shiftKey ? idx - 1 : idx + 1];
    if (next) { next.focus(); next.select(); }
}
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
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
    </svg>
);
const PlayIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
    </svg>
);
const PlusIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
    </svg>
);
const LayersIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>
);
const SwapIcon = ({ size = 14 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>
        <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
    </svg>
);
const TrendingUpIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
    </svg>
);

export default function RightPanel({
    selectedDay,
    handleAddExercise,
    handleAddMultipleExercises,
    handleReplaceExercise,
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
    clientId,
    planName,
    observationCounts,
    onObservationsChanged,
}) {
    const t = useTranslations('training');
    const locale = useLocale();
    const [showPicker, setShowPicker] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["exercises", "notes"]));
    const [videoModalId, setVideoModalId] = useState(null);
    const [expandedExerciseIds, setExpandedExerciseIds] = useState(() => new Set());
    const [insightsExercise, setInsightsExercise] = useState(null);
    const [replacingExerciseId, setReplacingExerciseId] = useState(null);

    const toggleExercise = (exercise) => {
        const key = exercise.exercise_library_id ?? exercise.id;
        setExpandedExerciseIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    if (!selectedDay) {
        return (
            <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
                <p className="text-muted-foreground text-sm text-center flex items-center justify-center h-full">{t('selectDay')}</p>
            </Surface>
        );
    }

    const videoExercise = (selectedDay.exercises ?? []).find(e => e.id === videoModalId);
    const videoExerciseName = videoExercise ? (getLocalizedField(videoExercise, "library_name", locale) || videoExercise.name || "") : "";

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
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

            <ExercisePickerModal
                open={!!replacingExerciseId}
                onClose={() => setReplacingExerciseId(null)}
                single
                title={t('replaceExercise')}
                confirmLabel={t('replaceExercise')}
                onAddExercises={(items) => {
                    if (items[0]) handleReplaceExercise(selectedDay.id, replacingExerciseId, items[0]);
                    setReplacingExerciseId(null);
                }}
            />

            <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

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
                                    <>
                                        <button
                                            title="Expand all exercises"
                                            onClick={() => setExpandedExerciseIds(new Set((selectedDay.exercises ?? []).map(e => e.exercise_library_id ?? e.id)))}
                                            className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-default transition-colors shrink-0"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <polyline points="7 6 12 11 17 6"/>
                                                <polyline points="7 13 12 18 17 13"/>
                                            </svg>
                                        </button>
                                        <button
                                            title="Collapse all exercises"
                                            onClick={() => setExpandedExerciseIds(new Set())}
                                            className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-default transition-colors shrink-0"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <polyline points="17 18 12 13 7 18"/>
                                                <polyline points="17 11 12 6 7 11"/>
                                            </svg>
                                        </button>
                                        <Button variant="outline" onClick={() => setShowPicker(true)} className="shrink-0">
                                            {t('addExercise')}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Disclosure.Heading>
                    </Disclosure>
                    {expandedKeys.has("exercises") && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                <div className="space-y-1.5 px-1 py-2">
                                    {(() => {
                                        const exercises = selectedDay.exercises ?? [];
                                        return (
                                        <SortableList items={exercises} onReorder={(from, to) => handleReorderExercises(selectedDay.id, from, to)}>
                                        {(exercise, originalIndex) => {
                                        const exerciseName = getLocalizedField(exercise, "library_name", locale) || exercise.name || "";
                                        const setCount = exercise.sets?.length ?? 0;
                                        const expandKey = exercise.exercise_library_id ?? exercise.id;
                                        const isExpanded = expandedExerciseIds.has(expandKey);
                                        const hasVideo = exercise.youtube_url || exercise.video_path;
                                        return (
                                        <SortableItem key={exercise.id} id={exercise.id}>
                                        {({ setNodeRef, style, attributes, listeners, isDragging }) => (
                                        <div
                                            ref={setNodeRef}
                                            style={style}
                                            {...attributes}
                                            {...listeners}
                                            className={`group select-none touch-none transition-all duration-150 rounded-xl overflow-hidden bg-app-surface-card shadow-surface ${isDragging ? "opacity-30 scale-95 z-10" : ""}`}
                                        >
                                            {/* Exercise row */}
                                            <div onClick={() => toggleExercise(exercise)} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isExpanded ? "bg-app-surface-selected hover:bg-app-surface-selected/80" : "hover:bg-app-surface-hover"}`}>
                                                {/* Drag grip */}
                                                <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0 select-none">
                                                    <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
                                                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                                        <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                                        <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                                    </svg>
                                                </span>
                                                {/* Thumbnail */}
                                                <div className="relative shrink-0 w-9 h-9 rounded-lg bg-foreground/10 flex items-center justify-center text-muted group-hover:text-foreground transition-colors overflow-hidden">
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
                                                {/* Name + meta */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate text-foreground" title={exerciseName}>
                                                        {exerciseName}
                                                    </p>
                                                    <p className="text-xs leading-5 text-muted truncate">
                                                        {exercise.muscle_group ? `${exercise.muscle_group} · ` : ""}{exercise.equipment ? `${exercise.equipment} · ` : ""}{setCount} sets
                                                    </p>
                                                </div>
                                                {/* Actions */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {hasVideo && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setVideoModalId(exercise.id); }}
                                                            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-default transition-colors cursor-pointer"
                                                            title={t('watchVideo')}
                                                        >
                                                            <PlayIcon />
                                                        </button>
                                                    )}
                                                    {(exercise.sets?.length ?? 0) > 0 && (selectedDay.exercises?.length ?? 0) > 1 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleApplySetsToAll(selectedDay.id, exercise.id); }}
                                                            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-default transition-colors cursor-pointer"
                                                            title="Apply this exercise's sets to all exercises in this day"
                                                        >
                                                            <LayersIcon />
                                                        </button>
                                                    )}
                                                    {clientId && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setInsightsExercise(exercise); }}
                                                            className="flex items-center gap-1 p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                            title="Exercise insights"
                                                        >
                                                            <TrendingUpIcon />
                                                            {(observationCounts?.[exercise.exercise_library_id ?? exercise.id] ?? 0) > 0 && (
                                                                <Chip size="sm" variant="soft">{observationCounts[exercise.exercise_library_id ?? exercise.id]}</Chip>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReplacingExerciseId(exercise.id); }}
                                                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                        title={t('replaceExercise')}
                                                    >
                                                        <SwapIcon size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteExercise(selectedDay.id, exercise.id); }}
                                                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                                        title={t('deleteExercise')}
                                                    >
                                                        <TrashIcon size={16} />
                                                    </button>
                                                    <ChevronIcon className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                </div>
                                            </div>

                                            {isExpanded && (
                                            <div className="px-3 pb-4 pt-0 flex flex-col gap-0">
                                                {/* Sets header */}
                                                <div className="flex items-center justify-between py-2 mt-2 mb-3 border-b border-border/20">
                                                    <Typography as="span" type="body-sm" weight="semibold" color="muted" className="uppercase tracking-wider">{t('sets')}</Typography>
                                                    <button
                                                        title={t('addSet')}
                                                        onClick={() => handleAddSet(selectedDay.id, exercise.id)}
                                                        className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-primary/10 active:bg-primary/15"
                                                    >
                                                        <PlusIcon /> {t('addSet')}
                                                    </button>
                                                </div>

                                            {/* Sets table */}
                                            <Table variant="secondary" aria-label="Sets" className="sets-table mb-0">
                                                <Table.ScrollContainer>
                                                    <Table.Content aria-label="Sets">
                                                        <Table.Header>
                                                            <Table.Column isRowHeader className="p-1.5 text-[10px] font-medium uppercase tracking-wider text-center">#</Table.Column>
                                                            <Table.Column className="p-1.5 text-[10px] font-medium uppercase tracking-wider text-center">{t('reps')}</Table.Column>
                                                            <Table.Column className="p-1.5 text-[10px] font-medium uppercase tracking-wider text-center">{t('rest')}</Table.Column>
                                                            <Table.Column className="p-1.5 text-[10px] font-medium uppercase tracking-wider text-center">{t('tempo')}</Table.Column>
                                                            <Table.Column className="p-1.5 text-[10px] font-medium uppercase tracking-wider text-center">{t('rir')}</Table.Column>
                                                            <Table.Column className="p-1.5 text-end"><span className="sr-only">Actions</span></Table.Column>
                                                        </Table.Header>
                                                        <Table.Body>
                                                            {(exercise.sets ?? []).map((set, sIdx) => (
                                                                <Table.Row key={set.id} id={set.id} className="group/set">
                                                                    <Table.Cell className="p-1.5 text-xs text-muted">{sIdx + 1}</Table.Cell>
                                                                    <Table.Cell className="p-1.5">
                                                                        <TextField className="min-w-0" value={String(set.reps ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "reps", val)} aria-label={t('reps')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} onKeyDown={handleSetInputTab} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="p-1.5">
                                                                        <TextField className="min-w-0" value={String(set.rest_seconds ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rest_seconds", val)} aria-label={t('rest')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} onKeyDown={handleSetInputTab} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="p-1.5">
                                                                        <TextField className="min-w-0" value={String(set.tempo ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "tempo", val)} aria-label={t('tempo')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} onKeyDown={handleSetInputTab} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="p-1.5">
                                                                        <TextField className="min-w-0" value={String(set.rir ?? "")} onChange={(val) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rir", val)} aria-label={t('rir')}>
                                                                            <Input variant="secondary" onFocus={(e) => e.target.select()} onKeyDown={handleSetInputTab} className={SET_INPUT_CLASS} />
                                                                        </TextField>
                                                                    </Table.Cell>
                                                                    <Table.Cell className="p-1.5">
                                                                        <div className="flex justify-end gap-0.5">
                                                                            <button
                                                                                onClick={() => handleDuplicateSet(selectedDay.id, exercise.id, set.id)}
                                                                                className="p-0.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                                                title={t('duplicateSet')}
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteSet(selectedDay.id, exercise.id, set.id)}
                                                                                className="p-0.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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

                                            {/* Exercise notes — secondary section */}
                                            <div className="mt-5 border-t border-border/50" />
                                            <TextField
                                                value={exercise.notes ?? ""}
                                                onChange={(val) => handleUpdateExerciseNotes(selectedDay.id, exercise.id, val)}
                                                aria-label={t('exerciseNotes')}
                                                className="w-full mt-3"
                                            >
                                                <Input variant="secondary" placeholder={t('exerciseNotes')} className="h-8 px-2 py-0 text-xs shadow-none bg-app-surface-input!" />
                                            </TextField>
                                            </div>
                                            )}
                                        </div>
                                        )}
                                        </SortableItem>
                                        );
                                        }}
                                        </SortableList>
                                        );
                                    })()}

                                    {(selectedDay.exercises ?? []).length === 0 && (
                                        <div className="py-8 flex flex-col items-center justify-center gap-1 text-center">
                                            <p className="text-sm text-muted-foreground">{t('noExercises')}</p>
                                            <p className="text-xs text-muted-foreground/70">{t('restDayHint')}</p>
                                        </div>
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

            <ExerciseInsightsModal
                open={!!insightsExercise}
                onClose={() => { setInsightsExercise(null); onObservationsChanged?.(); }}
                exercise={insightsExercise}
                clientId={clientId}
                planName={planName}
            />

            {/* Video Modal */}
            <Modal isOpen={!!videoModalId} onOpenChange={(o) => !o && setVideoModalId(null)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-2xl w-full">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>{videoExerciseName}</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                {videoExercise && (
                                    <div className="rounded-lg overflow-hidden bg-black aspect-video">
                                        {getYoutubeEmbedUrl(videoExercise.youtube_url) ? (
                                            <iframe
                                                src={getYoutubeEmbedUrl(videoExercise.youtube_url)}
                                                className="w-full h-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        ) : (
                                            <video src={videoExercise.video_path} controls className="w-full h-full" />
                                        )}
                                    </div>
                                )}
                            </Modal.Body>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </Surface>
    );
}
