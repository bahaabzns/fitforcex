import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { ClipboardList, ListTodo } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Menu } from "@heroui/react/menu";
import { Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { MenuTrigger, Popover as AriaPopover } from "react-aria-components";
import InlineEditField from "@/app/components/InlineEditField";
import EmptyState from "@/app/components/EmptyState";
import { SortableList, SortableItem } from "@/app/components/SortableList";
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
    const { resolvedTheme } = useTheme();
    const QUESTION_TYPES = QUESTION_TYPE_VALUES.map(q => ({ ...q, label: t(q.labelKey) }));
    const [questionsCollapsed, setQuestionsCollapsed] = useState(false);

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

            {/* Form Title (EN + Arabic) inline edit + close */}
            <div className="mb-3 shrink-0">
                <div className="flex justify-between items-center gap-4">
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
                <InlineEditField
                    key={`title-ar-${selectedForm.id}`}
                    value={selectedForm.title_ar || ""}
                    onCommit={(text) => handleEditForm(selectedForm.id, { title_ar: text || null })}
                    ariaLabel={t('titleArLabel')}
                    variant="primary"
                    dir="rtl"
                    placeholder={t('titleArHint')}
                    className="w-full mt-1.5"
                    inputClassName="text-sm text-muted-foreground"
                />
            </div>

            {/* Description inline edit */}
            <TextField key={`desc-${selectedForm.id}`} variant="secondary" fullWidth className="mb-2 shrink-0">
                <TextArea
                    rows={2}
                    defaultValue={selectedForm.description_en || ''}
                    placeholder={t('descriptionHint')}
                    onBlur={(e) => {
                        const val = e.target.value.trim() || null;
                        if (val !== (selectedForm.description_en || null)) {
                            handleEditForm(selectedForm.id, { description_en: val });
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') { e.target.value = selectedForm.description_en || ''; e.target.blur(); }
                    }}
                    className="resize-none text-sm"
                />
            </TextField>
            <div className="mb-3 shrink-0">
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('descriptionArLabel')}</label>
                <TextField key={`desc-ar-${selectedForm.id}`} variant="secondary" fullWidth>
                    <TextArea
                        rows={2}
                        dir="rtl"
                        defaultValue={selectedForm.description_ar || ''}
                        placeholder={t('descriptionArHint')}
                        onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (val !== (selectedForm.description_ar || null)) {
                                handleEditForm(selectedForm.id, { description_ar: val });
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') { e.target.value = selectedForm.description_ar || ''; e.target.blur(); }
                        }}
                        className="resize-none text-sm"
                    />
                </TextField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 shrink-0">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('afterSubmissionAction')}</label>
                    <Select
                        variant="secondary"
                        fullWidth
                        aria-label={t('afterSubmissionAction')}
                        value={selectedForm.postAction || selectedForm.post_action || 'nothing'}
                        onChange={(key) => handleEditForm(selectedForm.id, { postAction: key })}
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item id="nothing" textValue={t('actionNothing')}>
                                    {t('actionNothing')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="nutrition-plan" textValue={t('actionNutrition')}>
                                    {t('actionNutrition')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="workout-plan" textValue={t('actionWorkout')}>
                                    {t('actionWorkout')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('formType')}</label>
                    <Select
                        variant="secondary"
                        fullWidth
                        aria-label={t('formType')}
                        value={selectedForm.formType || selectedForm.form_type || 'check-in'}
                        onChange={(key) => handleEditForm(selectedForm.id, { formType: key })}
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item id="check-in" textValue={t('formTypeCheckin')}>
                                    {t('formTypeCheckin')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="assessment" textValue={t('formTypeAssessment')}>
                                    {t('formTypeAssessment')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            </ListBox>
                        </Select.Popover>
                    </Select>
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
                        <MenuTrigger>
                            <Button variant="primary">
                                {t('newQuestion')}
                            </Button>
                            <AriaPopover className={`${resolvedTheme === "dark" ? "dark" : ""} popover min-w-45 rounded-2xl! outline-none`} placement="bottom end" offset={6}>
                                <Menu
                                    className="p-2! gap-0.5! outline-none focus:outline-none focus-visible:outline-none"
                                    aria-label={t('newQuestion')}
                                    onAction={(key) => handleCreateQuestion(key)}
                                >
                                    {QUESTION_TYPES.map(({ value, label, icon: Icon }) => (
                                        <Menu.Item key={value} id={value} className="rounded-2xl! px-3! py-2! gap-3!">
                                            <Icon size={16} className="shrink-0 opacity-70" />
                                            {label}
                                        </Menu.Item>
                                    ))}
                                </Menu>
                            </AriaPopover>
                        </MenuTrigger>
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
                                <SortableList items={questions} onReorder={handleReorderQuestions}>
                                {(q, i) => {
                                    const isSelected = selectedQuestion?.id === q.id;
                                    const typeMeta = QUESTION_TYPES.find(qt => qt.value === q.type);
                                    return (
                                        <SortableItem key={q.id} id={q.id}>
                                        {({ setNodeRef, style, attributes, listeners, isDragging }) => (
                                        <div
                                            ref={setNodeRef}
                                            style={style}
                                            {...attributes}
                                            {...listeners}
                                            onClick={() => setSelectedQuestion(q)}
                                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer touch-none shadow-surface transition-all duration-150 select-none ${
                                                isDragging ? "opacity-30 scale-95 z-10" : ""
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
                                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border font-medium ${
                                                isSelected
                                                    ? "bg-primary/10 text-primary border-primary/30"
                                                    : "bg-secondary text-muted-foreground border-border"
                                            }`}>
                                                {typeMeta?.icon && <typeMeta.icon size={12} />}
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
                                        )}
                                        </SortableItem>
                                    );
                                }}
                                </SortableList>
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
        <InlineEditField
            ref={ref}
            key={form.id}
            value={form.title_en}
            fallback="Untitled Form"
            onCommit={(name) => onUpdate(form.id, { title_en: name })}
            ariaLabel="Form title"
            variant="primary"
            className="flex-1 min-w-0"
            inputClassName="text-base font-semibold truncate"
        />
    );
}
