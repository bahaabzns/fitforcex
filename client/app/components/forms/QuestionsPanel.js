import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, ListTodo } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import EmptyState from "@/app/components/EmptyState";
import { QUESTION_TYPE_VALUES } from "./questionTypes";

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
    selectedForm, setSelectedForm,
    questions,
    selectedQuestion,
    setSelectedQuestion,
    pendingFocusFormId, setPendingFocusFormId,
    pendingFocusQuestionId, setPendingFocusQuestionId,
    handleCreateQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleReorderQuestions,
    handleEditForm,
}) {
    const t = useTranslations('forms');
    const tCommon = useTranslations('common');
    const QUESTION_TYPES = QUESTION_TYPE_VALUES.map(q => ({ ...q, label: t(q.labelKey) }));
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [questionsCollapsed, setQuestionsCollapsed] = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const typePickerRef = useRef(null);

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

    const previewQuestions = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return questions;
        const arr = [...questions];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    if (!selectedForm) {
        return (
            <Surface variant="default" className="w-full flex flex-col min-h-full p-3 rounded-2xl shadow-surface">
                <EmptyState
                    variant="firstTime"
                    icon={ClipboardList}
                    title={t('selectForm')}
                    description={t('selectFormHint')}
                />
            </Surface>
        );
    }

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden min-h-full p-3 rounded-2xl shadow-surface">

            {/* Form Title inline edit + close */}
            <div className="flex justify-between items-center mb-3 gap-4 shrink-0">
                <FormTitleInput
                    form={selectedForm}
                    onUpdate={handleEditForm}
                    pendingFocusFormId={pendingFocusFormId}
                    setPendingFocusFormId={setPendingFocusFormId}
                />
                <button
                    title={tCommon('close')}
                    className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                    onClick={() => setSelectedForm(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            {/* Description inline edit */}
            <textarea
                key={`desc-${selectedForm.id}`}
                rows={2}
                defaultValue={selectedForm.description_en || ''}
                placeholder={t('descriptionHint')}
                onBlur={(e) => {
                    const val = e.target.value.trim() || null;
                    if (val !== (selectedForm.description_en || null)) {
                        handleEditForm(selectedForm.id, { description_en: val });
                    }
                }}
                className="w-full mb-3 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors shrink-0"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 shrink-0">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('afterSubmissionAction')}</label>
                    <select
                        value={selectedForm.post_action || selectedForm.postAction || 'nothing'}
                        onChange={(e) => handleEditForm(selectedForm.id, { postAction: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                    >
                        <option value="nothing">{t('actionNothing')}</option>
                        <option value="nutrition-plan">{t('actionNutrition')}</option>
                        <option value="workout-plan">{t('actionWorkout')}</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('formType')}</label>
                    <select
                        value={selectedForm.form_type || selectedForm.formType || 'check-in'}
                        onChange={(e) => handleEditForm(selectedForm.id, { formType: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                    >
                        <option value="check-in">{t('formTypeCheckin')}</option>
                        <option value="assessment">{t('formTypeAssessment')}</option>
                    </select>
                </div>
            </div>

            <Separator className="my-2 shrink-0" />

            {/* Questions Section */}
            <div className="flex flex-col min-h-0 flex-1">

                {/* Questions Header */}
                <div className="flex items-center gap-3 mb-3 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => setQuestionsCollapsed(c => !c)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={questionsCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </button>
                    <h3 className="text-base font-semibold text-foreground flex-1">
                        {t('questions')}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{questions.length}</span>
                    </h3>
                    {!questionsCollapsed && (
                        <div className="relative" ref={typePickerRef}>
                            <Button variant="primary" onClick={() => setShowTypePicker(v => !v)}>
                                {t('newQuestion')}
                            </Button>
                            {showTypePicker && (
                                <div className="absolute right-0 top-9 z-30 bg-card border border-border rounded-xl shadow-lg py-1.5 min-w-45">
                                    {QUESTION_TYPES.map(({ value, label, icon }) => (
                                        <button
                                            key={value}
                                            className="cursor-pointer flex items-center gap-3 w-full px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
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
                    )}
                </div>

                {!questionsCollapsed && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                        {questions.length === 0 ? (
                            <EmptyState
                                variant="firstTime"
                                icon={ListTodo}
                                title={t('noQuestionsYet')}
                                description={t('noQuestionsHint')}
                            />
                        ) : (
                            <div className="flex flex-col gap-2 px-1 py-1">
                                {previewQuestions.map((q, i) => {
                                    const originalIndex = questions.findIndex(orig => orig.id === q.id);
                                    const isDragging = dragIndex !== null && questions[dragIndex]?.id === q.id;
                                    const isSelected = selectedQuestion?.id === q.id;
                                    const typeMeta = QUESTION_TYPES.find(qt => qt.value === q.type);
                                    return (
                                        <div
                                            key={q.id}
                                            draggable
                                            onDragStart={() => setDragIndex(originalIndex)}
                                            onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                            onDrop={() => { handleReorderQuestions(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                            onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                            onClick={() => setSelectedQuestion(q)}
                                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer shadow-surface transition-all duration-150 select-none ${
                                                isDragging ? "opacity-30 scale-95" : ""
                                            } ${
                                                isSelected
                                                    ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40"
                                                    : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
                                            }`}
                                        >
                                            {/* Drag grip */}
                                            <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0 select-none">
                                                <GripIcon />
                                            </span>

                                            {/* Question number */}
                                            <span className="text-xs text-muted-foreground shrink-0">{i + 1}.</span>

                                            {/* Label */}
                                            <span className={`flex-1 text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                                {q.label_en}
                                            </span>

                                            {/* Type badge */}
                                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                                                isSelected
                                                    ? "bg-primary/10 text-primary border-primary/30"
                                                    : "bg-secondary text-muted-foreground border-border"
                                            }`}>
                                                {typeMeta?.icon}
                                            </span>

                                            {/* Tracked metric dot */}
                                            {q.metric_id && (
                                                <span title="Tracks a metric" className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary/60" />
                                            )}

                                            {/* Required dot */}
                                            {q.required && (
                                                <span title="Required" className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
                                            )}

                                            {/* Delete */}
                                            <button
                                                title={t('deleteQuestion')}
                                                className="cursor-pointer shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Removed locally now; if it has recorded answers, the
                                                    // save will reject the batch and restore it — see
                                                    // useFormBuilder.js's handleSaveDraft.
                                                    handleDeleteQuestion(q.id);
                                                }}
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollShadow>
                )}
            </div>
        </Surface>
    );
}

function FormTitleInput({ form, onUpdate, pendingFocusFormId, setPendingFocusFormId }) {
    const ref = useRef(null);

    useEffect(() => {
        if (pendingFocusFormId && form.id === pendingFocusFormId) {
            ref.current?.focus();
            ref.current?.select();
            setPendingFocusFormId(null);
        }
    }, [pendingFocusFormId, form.id, setPendingFocusFormId]);

    return (
        <input
            ref={ref}
            key={form.id}
            type="text"
            defaultValue={form.title_en}
            onBlur={(e) => {
                const trimmed = e.target.value.trim() || "Untitled Form";
                e.target.value = trimmed;
                if (trimmed !== form.title_en) onUpdate(form.id, { title_en: trimmed });
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') { e.target.value = form.title_en; e.target.blur(); }
            }}
            className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
        />
    );
}
