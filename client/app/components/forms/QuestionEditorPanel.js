import { useState, useEffect, useRef } from "react";

const QUESTION_TYPES = [
    { value: "text",        label: "Short Text",    icon: "T" },
    { value: "long_text",   label: "Long Text",     icon: "¶" },
    { value: "number",      label: "Number",        icon: "#" },
    { value: "scale",       label: "Scale",         icon: "↔" },
    { value: "select",      label: "Single Choice", icon: "◉" },
    { value: "multiselect", label: "Multi Choice",  icon: "☑" },
    { value: "date",        label: "Date",          icon: "📅" },
];

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);

export default function QuestionEditorPanel({
    selectedQuestion, setSelectedQuestion,
    pendingFocusQuestionId, setPendingFocusQuestionId,
    handleUpdateQuestion,
}) {
    const labelRef = useRef(null);
    const [newOption, setNewOption] = useState("");

    // Focus label when a new question is created
    useEffect(() => {
        if (pendingFocusQuestionId && selectedQuestion?.id === pendingFocusQuestionId) {
            labelRef.current?.focus();
            labelRef.current?.select();
            setPendingFocusQuestionId(null);
        }
    }, [pendingFocusQuestionId, selectedQuestion?.id, setPendingFocusQuestionId]);

    if (!selectedQuestion) {
        return (
            <div className="card w-full flex flex-col items-center justify-center min-h-full gap-3 text-center py-12">
                <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">No question selected</p>
                <p className="text-xs text-gray-400">Click a question to edit its details</p>
            </div>
        );
    }

    const q = selectedQuestion;
    const hasOptions    = q.type === 'select' || q.type === 'multiselect';
    const hasPlaceholder = ['text', 'long_text', 'number'].includes(q.type);
    const hasScale      = q.type === 'scale';

    function save(updates) {
        handleUpdateQuestion(q.id, updates);
    }

    function addOption() {
        const val = newOption.trim();
        if (!val) return;
        const updated = [...(q.options || []), val];
        save({ options: updated });
        setNewOption("");
    }

    function removeOption(idx) {
        const updated = (q.options || []).filter((_, i) => i !== idx);
        save({ options: updated });
    }

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">

            {/* Header — inline label input + close */}
            <div className="flex justify-between items-center mb-3 gap-4 shrink-0">
                <input
                    ref={labelRef}
                    key={`label-${q.id}`}
                    type="text"
                    defaultValue={q.label}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || "Question";
                        e.target.value = trimmed;
                        if (trimmed !== q.label) save({ label: trimmed });
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') { e.target.value = q.label; e.target.blur(); }
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 truncate text-gray-900"
                />
                <button
                    title="Close"
                    className="cursor-pointer p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                    onClick={() => setSelectedQuestion(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            {/* Divider */}
            <div className="shrink-0 border-t border-gray-100 mb-4" />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-5 pb-4">

            {/* Type */}
            <Field label="Question Type">
                <select
                    key={`type-${q.id}`}
                    defaultValue={q.type}
                    onChange={(e) => save({ type: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                >
                    {QUESTION_TYPES.map(({ value, label, icon }) => (
                        <option key={value} value={value}>{icon} {label}</option>
                    ))}
                </select>
            </Field>

            {/* Required */}
            <div className="flex items-center justify-between gap-3 shrink-0">
                <div>
                    <p className="text-sm font-medium text-gray-700">Required</p>
                    <p className="text-xs text-gray-400">Client must answer this question</p>
                </div>
                <button
                    onClick={() => save({ required: !q.required })}
                    className={`cursor-pointer relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                        q.required ? "bg-blue-500" : "bg-gray-200"
                    }`}
                >
                    <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            q.required ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                </button>
            </div>

            {/* Placeholder — text / long_text / number */}
            {hasPlaceholder && (
                <Field label="Placeholder Text">
                    <input
                        key={`ph-${q.id}`}
                        type="text"
                        defaultValue={q.placeholder || ''}
                        onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (val !== (q.placeholder || null)) save({ placeholder: val });
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        placeholder="e.g. Your answer here…"
                        className="w-full px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none placeholder-gray-400 hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                    />
                </Field>
            )}

            {/* Scale min/max */}
            {hasScale && (
                <Field label="Scale Range">
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">Min</label>
                            <input
                                key={`min-${q.id}`}
                                type="number"
                                defaultValue={q.min_value ?? 1}
                                onBlur={(e) => save({ min_value: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none text-center hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                                min={0} max={10}
                            />
                        </div>
                        <span className="text-gray-300 mt-5 text-lg">—</span>
                        <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">Max</label>
                            <input
                                key={`max-${q.id}`}
                                type="number"
                                defaultValue={q.max_value ?? 10}
                                onBlur={(e) => save({ max_value: parseInt(e.target.value) || 10 })}
                                className="w-full px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none text-center hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                                min={1} max={100}
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        {[...Array(Math.min((q.max_value ?? 10) - (q.min_value ?? 1) + 1, 11))].map((_, i) => {
                            const val = (q.min_value ?? 1) + i;
                            return (
                                <div key={val} className="flex flex-col items-center gap-1">
                                    <div className="w-7 h-7 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-xs text-gray-500 font-medium">
                                        {val}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Field>
            )}

            {/* Options — select / multiselect */}
            {hasOptions && (
                <Field label={`Options (${(q.options || []).length})`}>
                    {/* Existing options */}
                    <div className="flex flex-col gap-1.5 mb-3">
                        {(q.options || []).length === 0 ? (
                            <p className="text-xs text-gray-400 py-2 text-center">No options yet — add one below</p>
                        ) : (
                            (q.options || []).map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2 group">
                                    <span className={`shrink-0 w-4 h-4 rounded-full border-2 border-gray-300 ${q.type === 'multiselect' ? 'rounded' : 'rounded-full'}`} />
                                    <span className="flex-1 text-sm text-gray-700 truncate">{opt}</span>
                                    <button
                                        className="cursor-pointer shrink-0 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        onClick={() => removeOption(idx)}
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Add new option */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newOption}
                            onChange={(e) => setNewOption(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                            placeholder="Add option…"
                            className="flex-1 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none placeholder-gray-400 hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                        />
                        <button
                            onClick={addOption}
                            className="cursor-pointer h-9 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shrink-0"
                        >
                            Add
                        </button>
                    </div>
                </Field>
            )}

            {/* Preview */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                <QuestionPreview question={q} />
            </div>

            </div>{/* end scrollable content */}
        </div>
    );
}

function Field({ label, required, children }) {
    return (
        <div className="shrink-0">
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {children}
        </div>
    );
}

function QuestionPreview({ question: q }) {
    const ph = q.placeholder || "Your answer…";
    switch (q.type) {
        case 'text':
            return <input type="text" placeholder={ph} disabled className="input-field text-sm opacity-60 w-full" />;
        case 'long_text':
            return <textarea rows={2} placeholder={ph} disabled className="input-field text-sm opacity-60 w-full resize-none" />;
        case 'number':
            return <input type="number" placeholder={ph} disabled className="input-field text-sm opacity-60 w-full" />;
        case 'date':
            return <input type="date" disabled className="input-field text-sm opacity-60 w-full" />;
        case 'scale': {
            const min = q.min_value ?? 1;
            const max = q.max_value ?? 10;
            const count = Math.min(max - min + 1, 11);
            return (
                <div className="flex gap-1 flex-wrap">
                    {[...Array(count)].map((_, i) => (
                        <div key={i} className="flex-1 min-w-7 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-xs text-gray-500 font-medium">
                            {min + i}
                        </div>
                    ))}
                </div>
            );
        }
        case 'select':
        case 'multiselect': {
            const opts = q.options || [];
            if (opts.length === 0) return <p className="text-xs text-gray-400">No options added yet</p>;
            return (
                <div className="flex flex-col gap-1.5">
                    {opts.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 cursor-not-allowed opacity-60">
                            <input
                                type={q.type === 'multiselect' ? 'checkbox' : 'radio'}
                                disabled
                                className="accent-blue-500"
                            />
                            <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                    ))}
                </div>
            );
        }
        default:
            return null;
    }
}
