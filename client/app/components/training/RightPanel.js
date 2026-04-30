import React, { useState } from "react";
import ExercisePickerModal from "@/app/components/training/ExercisePickerModal";

const INPUT_CLASS = "h-8 w-full rounded-md border border-gray-300 px-2 text-xs focus:outline-none focus:border-blue-300";
const SERVER = "http://localhost:4000";

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
const ChevronIcon = ({ up }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
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
    const [showPicker, setShowPicker] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [exercisesCollapsed, setExercisesCollapsed] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [videoOpenId, setVideoOpenId] = useState(null);

    if (!selectedDay) {
        return (
            <div className="card w-full flex flex-col overflow-hidden min-h-full">
                <p className="text-gray-500 text-sm text-center flex items-center justify-center h-full">Select a day to edit exercises</p>
            </div>
        );
    }

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 gap-4 shrink-0">
                <input
                    key={selectedDay.id}
                    type="text"
                    defaultValue={selectedDay.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || "Untitled Day";
                        e.target.value = trimmed;
                        if (trimmed !== selectedDay.name) handleRenameDay(selectedDay.id, trimmed);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") { e.target.value = selectedDay.name; e.target.blur(); }
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 truncate text-gray-900"
                />
                {onClose && (
                    <button
                        title="Close panel"
                        onClick={onClose}
                        className="cursor-pointer p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
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

            {/* Exercises section header */}
            <div className="flex items-center gap-3 my-3 shrink-0">
                <button
                    className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    onClick={() => setExercisesCollapsed(v => !v)}
                >
                    <ChevronIcon up={!exercisesCollapsed} />
                </button>
                <h3 className="text-base font-semibold text-gray-900 flex-1">
                    Exercises
                    <span className="ml-2 text-xs font-normal text-gray-400">{selectedDay.exercises?.length ?? 0}</span>
                </h3>
                {!exercisesCollapsed && (
                    <button
                        onClick={() => setShowPicker(true)}
                        className="h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                        + Add Exercise
                    </button>
                )}
            </div>

            {/* Exercises */}
            {!exercisesCollapsed && <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
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
                        className={`group rounded-xl border border-gray-200 p-3 select-none transition-all ${isDragging ? "opacity-30 scale-95" : ""}`}
                    >
                        {/* Exercise header */}
                        <div className="flex items-start gap-2 mb-2">
                            {/* Thumbnail */}
                            {exercise.thumbnail_path ? (
                                <img
                                    src={`${SERVER}${exercise.thumbnail_path}`}
                                    alt={exercise.name}
                                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-300">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                    </svg>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    {/* Drag grip */}
                                    <span className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0">
                                        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                            <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                            <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                            <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                        </svg>
                                    </span>
                                    <span className="text-xs font-semibold text-blue-600 shrink-0">#{index + 1}</span>
                                    <input
                                        value={exercise.name}
                                        onChange={(e) => handleRenameExercise(selectedDay.id, exercise.id, e.target.value)}
                                        className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none min-w-0"
                                    />
                                    {exercise.exercise_library_id && (
                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold shrink-0">lib</span>
                                    )}
                                    {(exercise.youtube_url || exercise.video_path) && (
                                        <button
                                            onClick={() => setVideoOpenId(videoOpenId === exercise.id ? null : exercise.id)}
                                            className={`shrink-0 p-1 rounded transition-colors cursor-pointer ${videoOpenId === exercise.id ? "text-blue-500 bg-blue-50" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
                                            title={videoOpenId === exercise.id ? "Hide video" : "Watch video"}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteExercise(selectedDay.id, exercise.id)}
                                        className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                        title="Delete exercise"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                                {exercise.muscle_group && (
                                    <span className="text-[10px] text-gray-400 ml-1">{exercise.muscle_group}</span>
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
                            placeholder="Exercise notes (optional)..."
                            className="w-full mb-2 bg-transparent text-xs text-gray-500 focus:outline-none placeholder:text-gray-300 border-b border-transparent focus:border-gray-200"
                        />

                        {/* Sets header */}
                        <div className="grid grid-cols-[20px_1fr_1fr_1fr_1fr_16px_16px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                            <span>#</span>
                            <span>Reps</span>
                            <span>Rest</span>
                            <span>Tempo</span>
                            <span>RIR</span>
                            <span/><span/>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {(exercise.sets ?? []).map((set, sIdx) => (
                                <div key={set.id} className="group/set grid grid-cols-[20px_1fr_1fr_1fr_1fr_16px_16px] gap-2 items-center">
                                    <span className="text-xs text-gray-400">{sIdx + 1}</span>
                                    <input value={set.reps ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "reps", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                    <input value={set.rest_seconds ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rest_seconds", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                    <input value={set.tempo ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "tempo", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                    <input value={set.rir ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rir", e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
                                    <button
                                        onClick={() => handleDuplicateSet(selectedDay.id, exercise.id, set.id)}
                                        className="p-0.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors cursor-pointer opacity-0 group-hover/set:opacity-100"
                                        title="Duplicate set"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSet(selectedDay.id, exercise.id, set.id)}
                                        className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover/set:opacity-100"
                                        title="Delete set"
                                    >
                                        <TrashIcon size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                            <button
                                onClick={() => handleAddSet(selectedDay.id, exercise.id)}
                                className="h-7 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                                + Add Set
                            </button>
                            {(exercise.sets?.length ?? 0) > 0 && (selectedDay.exercises?.length ?? 0) > 1 && (
                                <button
                                    onClick={() => handleApplySetsToAll(selectedDay.id, exercise.id)}
                                    className="h-7 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 text-xs font-semibold transition-colors cursor-pointer"
                                    title="Copy this exercise's sets to all other exercises in the day"
                                >
                                    Apply to all
                                </button>
                            )}
                        </div>
                    </div>
                    );
                    });
                })()}

                {(selectedDay.exercises ?? []).length === 0 && (
                    <div className="text-center text-sm text-gray-400 py-10">No exercises in this day yet</div>
                )}
            </div>}

            {/* Divider */}
            <div className="shrink-0 border-t border-gray-100 my-3" />

            {/* Day Notes — collapsible */}
            <div className="flex flex-col shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        onClick={() => setNotesOpen(v => !v)}
                    >
                        <ChevronIcon up={!notesOpen} />
                    </button>
                    <h3 className="text-base font-semibold text-gray-900">Notes</h3>
                </div>
                {notesOpen && (
                    <textarea
                        key={selectedDay.id + "-note"}
                        defaultValue={selectedDay.notes ?? ""}
                        placeholder="Add notes for this day..."
                        rows={3}
                        onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== (selectedDay.notes ?? "")) handleUpdateDayNotes(selectedDay.id, val);
                        }}
                        className="w-full mb-2 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none resize-none placeholder-gray-400 hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                    />
                )}
            </div>
        </div>
    );
}
