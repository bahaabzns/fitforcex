import { useState, useRef, useEffect } from "react";

function formatRelativeTime(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);

const DuplicateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
);

export default function FormsPanel({
    forms,
    sortedForms,
    selectedForm,
    sortOrder, setSortOrder,
    pendingFocusFormId, setPendingFocusFormId,
    handleSelectForm,
    handleCreateForm,
    handleUpdateForm,
    handleDeleteForm,
    handleDuplicateForm,
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">

            {/* Header */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                <button
                    className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    onClick={() => setCollapsed(c => !c)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points={collapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                    </svg>
                </button>
                <h2 className="text-base font-semibold text-gray-900 flex-1">
                    Forms
                    <span className="ml-2 text-xs font-normal text-gray-400">{forms.length}</span>
                </h2>
                {!collapsed && (
                    <button
                        className="cursor-pointer h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                        onClick={handleCreateForm}
                    >
                        + New Form
                    </button>
                )}
            </div>

            {!collapsed && (
                <>
                    {/* Sort Pills */}
                    <div className="flex gap-2 mb-4 shrink-0">
                        {[
                            { value: "created_desc", label: "Newest" },
                            { value: "created_asc",  label: "Oldest" },
                            { value: "a-z",          label: "A–Z" },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setSortOrder(value)}
                                className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                                    sortOrder === value
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Form List */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {sortedForms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
                                <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">No forms yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Create your first form</p>
                                </div>
                                <button
                                    className="cursor-pointer h-8 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                                    onClick={handleCreateForm}
                                >
                                    + New Form
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {sortedForms.map((form) => {
                                    const isActive = selectedForm?.id === form.id;
                                    return (
                                        <FormItem
                                            key={form.id}
                                            form={form}
                                            isActive={isActive}
                                            pendingFocusFormId={pendingFocusFormId}
                                            setPendingFocusFormId={setPendingFocusFormId}
                                            onSelect={() => handleSelectForm(form)}
                                            onUpdate={(updates) => handleUpdateForm(form.id, updates)}
                                            onDelete={() => handleDeleteForm(form.id)}
                                            onDuplicate={() => handleDuplicateForm(form.id)}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function FormItem({ form, isActive, pendingFocusFormId, setPendingFocusFormId, onSelect, onUpdate, onDelete, onDuplicate }) {
    const titleRef = useRef(null);

    useEffect(() => {
        if (pendingFocusFormId === form.id) {
            titleRef.current?.focus();
            titleRef.current?.select();
            setPendingFocusFormId(null);
        }
    }, [pendingFocusFormId, form.id, setPendingFocusFormId]);

    return (
        <div
            onClick={onSelect}
            className={`group flex items-center gap-3 px-3 py-3 cursor-pointer rounded-xl transition-all duration-150 ${
                isActive
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-50 border border-transparent"
            }`}
        >
            {/* Active dot */}
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-blue-500" : "bg-gray-200 group-hover:bg-gray-300"}`} />

            {/* Info */}
            <div className="flex-1 min-w-0">
                {isActive ? (
                    <input
                        ref={titleRef}
                        key={form.id}
                        type="text"
                        defaultValue={form.title}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                            const trimmed = e.target.value.trim() || "Untitled Form";
                            e.target.value = trimmed;
                            if (trimmed !== form.title) onUpdate({ title: trimmed });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                            if (e.key === 'Escape') { e.target.value = form.title; e.target.blur(); }
                        }}
                        className="text-sm font-medium w-full bg-transparent border border-transparent rounded px-1 py-0.5 outline-none hover:border-blue-200 focus:border-blue-500 focus:bg-blue-100 text-blue-700 truncate"
                    />
                ) : (
                    <p className="text-sm font-medium truncate text-gray-800">{form.title}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                    {form.question_count} {form.question_count === 1 ? "question" : "questions"}
                    {" · "}
                    {form.status === 'active'
                        ? <span className="text-green-600 font-medium">Active</span>
                        : <span>Draft</span>
                    }
                    {" · "}
                    edited {formatRelativeTime(form.updated_at)}
                </p>
            </div>

            {/* Actions on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {form.status === 'active' ? (
                    <button
                        title="Set to Draft"
                        className="cursor-pointer px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 hover:border-gray-400 text-xs font-medium transition-colors"
                        onClick={(e) => { e.stopPropagation(); onUpdate({ status: 'draft' }); }}
                    >
                        Draft
                    </button>
                ) : (
                    <button
                        title="Set to Active"
                        className="cursor-pointer px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 hover:border-green-500 hover:text-green-600 hover:bg-green-50 text-xs font-medium transition-colors"
                        onClick={(e) => { e.stopPropagation(); onUpdate({ status: 'active' }); }}
                    >
                        Activate
                    </button>
                )}
                <button
                    title="Duplicate form"
                    className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                >
                    <DuplicateIcon />
                </button>
                <button
                    title="Delete form"
                    className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <TrashIcon />
                </button>
            </div>
        </div>
    );
}
