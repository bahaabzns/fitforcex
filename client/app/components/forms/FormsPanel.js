import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Disclosure, DisclosureGroup, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import EmptyState from "@/app/components/EmptyState";
import CardActionsMenu, { DuplicateIcon, TrashIcon } from "@/app/components/CardActionsMenu";

function formatRelativeTime(dateStr, t) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    if (diffDays < 30) return t('weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('monthsAgo', { count: Math.floor(diffDays / 30) });
    return t('yearsAgo', { count: Math.floor(diffDays / 365) });
}

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
    const tNutrition = useTranslations('nutrition');
    const [expandedKeys, setExpandedKeys] = useState(new Set(["forms"]));

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden min-h-full p-3 rounded-2xl shadow-surface">
            <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

                {/* Forms Section */}
                <div className="flex flex-col min-h-0" style={{ flex: expandedKeys.has("forms") ? "1 1 0" : "0 0 auto" }}>
                    <Disclosure id="forms">
                        <Disclosure.Heading>
                            <div className="flex items-center gap-2 w-full mb-4">
                                <Button
                                    slot="trigger"
                                    variant="ghost"
                                    className="flex-1 justify-start gap-2 px-0 data-hover:bg-transparent min-w-0"
                                >
                                    <h2 className="text-base font-semibold text-foreground">
                                        Forms
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{forms.length}</span>
                                    </h2>
                                    <Disclosure.Indicator />
                                </Button>
                                {expandedKeys.has("forms") && (
                                    <Button variant="primary" onClick={handleCreateForm} className="shrink-0">
                                        {tNutrition('newForm')}
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                        <Disclosure.Content>
                            <Disclosure.Body className="flex flex-col flex-1 min-h-0 px-0 pt-0">
                                {/* Sort Pills */}
                                <div className="flex gap-2 mb-4 shrink-0">
                                    {[
                                        { value: "created_desc", label: tNutrition('newest') },
                                        { value: "created_asc",  label: tNutrition('oldest') },
                                        { value: "a-z",          label: "A–Z" },
                                    ].map(({ value, label }) => (
                                        <button
                                            key={value}
                                            onClick={() => setSortOrder(value)}
                                            className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                                                sortOrder === value
                                                    ? "bg-primary border-primary text-white"
                                                    : "border-border text-muted-foreground hover:border-border hover:bg-default"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Form List */}
                                <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                    {sortedForms.length === 0 ? (
                                        <EmptyState
                                            variant="firstTime"
                                            icon={ClipboardList}
                                            title={tNutrition('formsEmptyTitle')}
                                            description={tNutrition('formsEmptyHint')}
                                            action={{ label: tNutrition('newForm'), onPress: handleCreateForm }}
                                        />
                                    ) : (
                                        <div className="flex flex-col gap-2 px-1 py-1">
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
                                </ScrollShadow>
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                </div>

            </DisclosureGroup>
        </Surface>
    );
}

function FormItem({ form, isActive, pendingFocusFormId, setPendingFocusFormId, onSelect, onUpdate, onDelete, onDuplicate }) {
    const tForms = useTranslations('forms');
    const tCommon = useTranslations('common');

    return (
        <div
            onClick={onSelect}
            className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl shadow-surface transition-all duration-150 ${
                isActive
                    ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40"
                    : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
            }`}
        >
            {/* Icon avatar */}
            <div className={`relative shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                isActive ? "bg-primary/25 text-primary" : "bg-foreground/10 text-muted-foreground group-hover:text-foreground"
            }`}>
                <ClipboardList size={16} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate flex-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                        {form.title_en}
                    </p>
                    {form.status === 'active' && (
                        <Chip size="sm" color="success" variant="soft" className="shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                            <Chip.Label>{tForms('active')}</Chip.Label>
                        </Chip>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {tForms('questionCount', { count: form.question_count ?? 0 })}
                    {" · "}
                    {tForms('edited')} {formatRelativeTime(form.updated_at, tCommon)}
                </p>
            </div>

            {/* Actions menu */}
            <CardActionsMenu
                isActive={isActive}
                ariaLabel={form.title_en}
                items={[
                    ...(form.status !== 'active' ? [{
                        key: 'activate',
                        label: tForms('setToActive'),
                        onSelect: () => onUpdate({ status: 'active' }),
                    }] : []),
                    { key: 'duplicate', label: tForms('duplicateForm'), icon: <DuplicateIcon />, onSelect: onDuplicate },
                    { key: 'delete', label: tForms('deleteForm'), icon: <TrashIcon />, danger: true, onSelect: onDelete },
                ]}
            />
        </div>
    );
}
