import { useState, useRef, useEffect } from "react";

const QUESTION_TYPES = [
    { value: "text",        label: "Short Text",   icon: "T" },
    { value: "long_text",   label: "Long Text",    icon: "¶" },
    { value: "number",      label: "Number",       icon: "#" },
    { value: "scale",       label: "Scale",        icon: "↔" },
    { value: "select",      label: "Single Choice",icon: "◉" },
    { value: "multiselect", label: "Multi Choice", icon: "☑" },
    { value: "date",        label: "Date",         icon: "📅" },
];

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);

const GripIcon = () => (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="currentColor">
        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
        <circle cx="2" cy="6.5" r="1.2"/><circle cx="6" cy="6.5" r="1.2"/>
        <circle cx="2" cy="11" r="1.2"/><circle cx="6" cy="11" r="1.2"/>
    </svg>
);

export default function QuestionsPanel({
    selectedForm,
    questions,
    selectedQuestion,
    setSelectedQuestion,
    pendingFocusQuestionId, setPendingFocusQuestionId,
    handleCreateQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleReorderQuestions,
    handleUpdateForm,
}) {
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const typePickerRef = useRef(null);

    // Close type picker on outside click
    useEffect(() => {
        if (!showTypePicker) return;
        function handler(e) {
            if (typePickerRef.current && !typePickerRef.current.contains(e.target)) {
                setShowTypePicker(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showTypePicker]);

    // Drag preview
    const previewQuestions = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return questions;
        const arr = [...questions];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    if (!selectedForm) {
        return (
            <div className="card w-full flex flex-col items-center justify-center min-h-full gap-3 text-center py-12">
                <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">Select a form</p>
                <p className="text-xs text-gray-400">Pick a form from the left panel to see its questions</p>
            </div>
        );
    }

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">

            {/* Form Title (inline edit) + close */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <FormTitleInput
                    form={selectedForm}
                    onUpdate={handleUpdateForm}
                />
                {/* Status toggle */}
                <button
                    title={selectedForm.status === 'active' ? 'Set to Draft' : 'Set to Active'}
                    onClick={() => handleUpdateForm(selectedForm.id, {
                        status: selectedForm.status === 'active' ? 'draft' : 'active'
                    })}
                    className={`cursor-pointer shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        selectedForm.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                >
                    {selectedForm.status === 'active' ? 'Active' : 'Draft'}
                </button>
            </div>

            {/* Description (inline edit) */}
            <textarea
                key={`desc-${selectedForm.id}`}
                rows={2}
                defaultValue={selectedForm.description || ''}
                placeholder="Form description (optional)"
                onBlur={(e) => {
                    const val = e.target.value.trim() || null;
                    if (val !== (selectedForm.description || null)) {
                        handleUpdateForm(selectedForm.id, { description: val });
                    }
                }}
                className="mb-4 w-full text-sm text-gray-600 bg-transparent border border-transparent rounded-lg px-2 py-1.5 outline-none resize-none hover:border-gray-200 focus:border-blue-400 focus:bg-blue-50 placeholder-gray-300 shrink-0 transition-colors"
            />

            {/* Section header */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <h3 className="text-sm font-semibold text-gray-700 flex-1">
                    Questions
                    <span className="ml-2 text-xs font-normal text-gray-400">{questions.length}</span>
                </h3>

                {/* Add Question button with type picker */}
                <div className="relative" ref={typePickerRef}>
                    <button
                        className="cursor-pointer h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                        onClick={() => setShowTypePicker(v => !v)}
                    >
                        + Question
                    </button>
                    {showTypePicker && (
                        <div className="absolute right-0 top-9 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[180px]">
                            {QUESTION_TYPES.map(({ value, label, icon }) => (
                                <button
                                    key={value}
                                    className="cursor-pointer flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    onClick={() => {
                                        handleCreateQuestion(value);
                                        setShowTypePicker(false);
                                    }}
                                >
                                    <span className="w-5 text-center text-base font-mono opacity-70">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Questions list */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
                        <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <p className="text-xs text-gray-400">No questions yet — add one above</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {previewQuestions.map((q, i) => {
                            const originalIndex = questions.findIndex(orig => orig.id === q.id);
                            const isDragging = dragIndex !== null && questions[dragIndex]?.id === q.id;
                            const isSelected = selectedQuestion?.id === q.id;
                            const typeMeta = QUESTION_TYPES.find(t => t.value === q.type);
                            return (
                                <div
                                    key={q.id}
                                    draggable
                                    onDragStart={() => setDragIndex(originalIndex)}
                                    onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                    onDrop={() => { handleReorderQuestions(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                    onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                    onClick={() => setSelectedQuestion(q)}
                                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none ${
                                        isDragging ? "opacity-30 scale-95" : ""
                                    } ${
                                        isSelected
                                            ? "bg-blue-50 border border-blue-200"
                                            : "border border-transparent hover:bg-gray-50 hover:border-gray-100"
                                    }`}
                                >
                                    {/* Drag handle */}
                                    <span className={`shrink-0 transition-opacity ${isSelected ? "opacity-40" : "opacity-20 group-hover:opacity-50"}`}>
                                        <GripIcon />
                                    </span>

                                    {/* Question number */}
                                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>

                                    {/* Label */}
                                    <span className={`flex-1 text-sm font-medium truncate ${isSelected ? "text-blue-700" : "text-gray-800"}`}>
                                        {q.label}
                                    </span>

                                    {/* Type badge */}
                                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                                        isSelected
                                            ? "bg-blue-100 text-blue-600 border-blue-200"
                                            : "bg-gray-100 text-gray-500 border-gray-200"
                                    }`}>
                                        {typeMeta?.icon} {typeMeta?.label}
                                    </span>

                                    {/* Required dot */}
                                    {q.required && (
                                        <span title="Required" className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                                    )}

                                    {/* Delete */}
                                    <button
                                        title="Delete question"
                                        className="cursor-pointer shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id); }}
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function FormTitleInput({ form, onUpdate }) {
    const ref = useRef(null);
    return (
        <input
            ref={ref}
            key={form.id}
            type="text"
            defaultValue={form.title}
            onBlur={(e) => {
                const trimmed = e.target.value.trim() || "Untitled Form";
                e.target.value = trimmed;
                if (trimmed !== form.title) onUpdate(form.id, { title: trimmed });
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') { e.target.value = form.title; e.target.blur(); }
            }}
            className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 truncate text-gray-900"
        />
    );
}
