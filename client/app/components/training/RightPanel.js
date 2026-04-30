import React from "react";

const INPUT_CLASS = "h-8 w-full rounded-md border border-gray-300 px-2 text-xs focus:outline-none focus:border-blue-300";

export default function RightPanel({
    selectedDay,
    handleAddExercise,
    handleDeleteExercise,
    handleRenameExercise,
    handleAddSet,
    handleUpdateSetField,
}) {
    if (!selectedDay) {
        return (
            <div className="card w-full flex flex-col overflow-hidden min-h-full">
                <p className="text-gray-500 text-sm text-center flex items-center justify-center h-full">Select a day to edit exercises</p>
            </div>
        );
    }

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">{selectedDay.name}</h3>
                <button
                    onClick={() => handleAddExercise(selectedDay.id)}
                    className="h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                    + Add Exercise
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
                {(selectedDay.exercises ?? []).map((exercise, index) => (
                    <div key={exercise.id} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-blue-600">#{index + 1}</span>
                            <input
                                value={exercise.name}
                                onChange={(e) => handleRenameExercise(selectedDay.id, exercise.id, e.target.value)}
                                className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none"
                            />
                            <button
                                onClick={() => handleDeleteExercise(selectedDay.id, exercise.id)}
                                className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                            >
                                Remove
                            </button>
                        </div>

                        <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                            <span>Set</span>
                            <span>Reps</span>
                            <span>Rest</span>
                            <span>Tempo</span>
                            <span>RIR</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            {(exercise.sets ?? []).map((set, sIdx) => (
                                <div key={set.id} className="grid grid-cols-5 gap-2 items-center">
                                    <span className="text-xs text-gray-500">{sIdx + 1}</span>
                                    <input
                                        value={set.reps ?? ""}
                                        onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "reps", e.target.value)}
                                        className={INPUT_CLASS}
                                    />
                                    <input
                                        value={set.rest_seconds ?? ""}
                                        onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rest_seconds", e.target.value)}
                                        className={INPUT_CLASS}
                                    />
                                    <input
                                        value={set.tempo ?? ""}
                                        onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "tempo", e.target.value)}
                                        className={INPUT_CLASS}
                                    />
                                    <input
                                        value={set.rir ?? ""}
                                        onChange={(e) => handleUpdateSetField(selectedDay.id, exercise.id, set.id, "rir", e.target.value)}
                                        className={INPUT_CLASS}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => handleAddSet(selectedDay.id, exercise.id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
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
