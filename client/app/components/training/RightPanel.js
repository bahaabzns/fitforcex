import React, { useState } from "react";
import ExercisePickerModal from "@/app/components/training/ExercisePickerModal";

const INPUT_CLASS = "h-8 w-full rounded-md border border-gray-300 px-2 text-xs focus:outline-none focus:border-blue-300";

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
    handleDeleteExercise,
    handleRenameExercise,
    handleUpdateExerciseNotes,
    handleAddSet,
    handleDeleteSet,
    handleUpdateSetField,
    handleUpdateDayNotes,
    onClose,
}) {
    const [showPicker, setShowPicker] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);

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
            <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">{selectedDay.name}</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPicker(true)}
                        className="h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                        + Add Exercise
                    </button>
                    {onClose && (
                        <button
                            title="Close panel"
                            onClick={onClose}
                            className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    )}
                </div>
            </div>

            <ExercisePickerModal
                open={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={(item) => { handleAddExercise(selectedDay.id, item); setShowPicker(false); }}
            />

            {/* Day Notes — collapsible */}
            <div className="shrink-0 mb-3">
                <button
                    onClick={() => setNotesOpen(o => !o)}
                    className="cursor-pointer flex items-center gap-2 w-full text-left py-1"
                >
                    <span className="text-xs font-semibold text-gray-500 flex-1">Day Notes</span>
                    <ChevronIcon up={notesOpen} />
                </button>
                {notesOpen && (
                    <textarea
                        value={selectedDay.notes ?? ""}
                        onChange={(e) => handleUpdateDayNotes(selectedDay.id, e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                        placeholder="Add notes for this day..."
                    />
                )}
            </div>

            {/* Exercises */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
                {(selectedDay.exercises ?? []).map((exercise, index) => (
                    <div key={exercise.id} className="group rounded-xl border border-gray-200 p-3">
                        {/* Exercise header */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-blue-600 shrink-0">#{index + 1}</span>
                            <input
                                value={exercise.name}
                                onChange={(e) => handleRenameExercise(selectedDay.id, exercise.id, e.target.value)}
                                className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none min-w-0"
                            />
                            {exercise.exercise_library_id && (
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold shrink-0">lib</span>
                            )}
                            <button
                                onClick={() => handleDeleteExercise(selectedDay.id, exercise.id)}
                                className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Delete exercise"
                            >
                                <TrashIcon />
                            </button>
                        </div>

                        {/* Exercise notes */}
                        <input
                            value={exercise.notes ?? ""}
                            onChange={(e) => handleUpdateExerciseNotes(selectedDay.id, exercise.id, e.target.value)}
                            placeholder="Exercise notes (optional)..."
                            className="w-full mb-2 bg-transparent text-xs text-gray-500 focus:outline-none placeholder:text-gray-300 border-b border-transparent focus:border-gray-200"
                        />

                        {/* Sets header */}
                        <div className="grid grid-cols-[20px_1fr_1fr_1fr_1fr_20px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                            <span>#</span>
                            <span>Reps</span>
                            <span>Rest</span>
                            <span>Tempo</span>
                            <span>RIR</span>
                            <span/>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {(exercise.sets ?? []).map((set, sIdx) => (
                                <div key={set.id} className="group/set grid grid-cols-[20px_1fr_1fr_1fr_1fr_20px] gap-2 items-center">
                                    <span className="text-xs text-gray-400">{sIdx + 1}</span>
                                    <input value={set.reps ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "reps", e.target.value)} className={INPUT_CLASS} />
                                    <input value={set.rest_seconds ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rest_seconds", e.target.value)} className={INPUT_CLASS} />
                                    <input value={set.tempo ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "tempo", e.target.value)} className={INPUT_CLASS} />
                                    <input value={set.rir ?? ""} onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rir", e.target.value)} className={INPUT_CLASS} />
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

                        <button
                            onClick={() => handleAddSet(selectedDay.id, exercise.id)}
                            className="mt-2 h-7 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                            + Add Set
                        </button>
                    </div>
                ))}

                {(selectedDay.exercises ?? []).length === 0 && (
                    <div className="text-center text-sm text-gray-400 py-10">No exercises in this day yet</div>
                )}
            </div>
        </div>
    );
}
