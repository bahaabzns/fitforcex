import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Disclosure, DisclosureGroup, Surface } from "@heroui/react";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import EmptyState from "@/app/components/EmptyState";
import CardActionsMenu, { DuplicateIcon, TrashIcon } from "@/app/components/CardActionsMenu";
import ImportGoogleFormDialog from "@/app/components/forms/ImportGoogleFormDialog";

// Simplified Google Forms mark (purple clipboard + checkmark) so the import
// button is recognizable at a glance, not just another generic upload icon.
const GoogleFormsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
        <rect x="6" y="4" width="30" height="40" rx="3" fill="#673AB7" />
        <rect x="12" y="14" width="18" height="2.5" fill="#fff" />
        <rect x="12" y="20" width="18" height="2.5" fill="#fff" />
        <rect x="12" y="26" width="12" height="2.5" fill="#fff" />
        <circle cx="33" cy="31" r="9" fill="#fff" />
        <path d="M29 31l3 3 6-6.5" stroke="#673AB7" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

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
    handleDeleteForm,
    handleArchiveForm,
    handleActivateForm,
    handleDuplicateForm,
    handleImportGoogleForm,
}) {
    const tNutrition = useTranslations('nutrition');
    const tForms = useTranslations('forms');
    const [expandedKeys, setExpandedKeys] = useState(new Set(["forms"]));
    const [isImportOpen, setIsImportOpen] = useState(false);

    // A form with client history can't be deleted (see forms.controller.ts —
    // `form_requests` would be silently destroyed by the DB cascade). Offer
    // archiving as the sanctioned alternative instead of just failing.
    async function handleDeleteOrArchive(form) {
        const result = await handleDeleteForm(form.id);
        if (result?.blocked) {
            const shouldArchive = window.confirm(
                tForms('archiveInsteadOfDeleteConfirm', { count: result.submissionCount })
            );
            if (shouldArchive) await archiveWithWarning(form);
        } else if (result && !result.ok) {
            window.alert(tForms('deleteFormFailed'));
        }
    }

    // Archiving itself is never destructive (see forms.controller.ts's
    // updateForm), but a form that's still a package default keeps being
    // offered by that package's future activations until the coach updates
    // it — surface that blast radius immediately rather than let the coach
    // find out later. Shared by both archive entry points (the direct menu
    // action and the archive-instead-of-delete prompt above).
    async function archiveWithWarning(form) {
        const result = await handleArchiveForm(form.id);
        if (!result?.ok) {
            window.alert(tForms('archiveFormFailed'));
            return;
        }
        if (result.warning) window.alert(result.warning);
    }

    return (
        <>
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
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Only the coach workspace builder wires this up — the Super
                                            Admin "Master Form Templates" builder (which reuses this same
                                            panel against a separate /admin/forms-templates backend) has
                                            no matching import endpoint, so this stays hidden there. */}
                                        {handleImportGoogleForm && (
                                            <Button
                                                variant="outline"
                                                onClick={() => setIsImportOpen(true)}
                                                className="gap-2"
                                            >
                                                <GoogleFormsIcon />
                                                {tForms('importFromGoogleForms')}
                                            </Button>
                                        )}
                                        <Button variant="primary" onClick={handleCreateForm}>
                                            {tNutrition('newForm')}
                                        </Button>
                                    </div>
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
                                                        onActivate={() => handleActivateForm(form.id)}
                                                        onDelete={() => handleDeleteOrArchive(form)}
                                                        onArchive={() => archiveWithWarning(form)}
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
        {handleImportGoogleForm && (
            <ImportGoogleFormDialog
                open={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                handleImportGoogleForm={handleImportGoogleForm}
            />
        )}
        </>
    );
}

function FormItem({ form, isActive, pendingFocusFormId, setPendingFocusFormId, onSelect, onActivate, onDelete, onArchive, onDuplicate }) {
    const tForms = useTranslations('forms');
    const tCommon = useTranslations('common');

    return (
        <div
            onClick={onSelect}
            className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl shadow-surface transition-all duration-150 ${
                form.status === 'archived' ? "opacity-60" : ""
            } ${
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
                    {form.status === 'archived' && (
                        <Chip size="sm" color="default" variant="soft" className="shrink-0">
                            <Chip.Label>{tForms('archived')}</Chip.Label>
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
                        onSelect: onActivate,
                    }] : []),
                    { key: 'duplicate', label: tForms('duplicateForm'), icon: <DuplicateIcon />, onSelect: onDuplicate },
                    ...(form.status !== 'archived' ? [{
                        key: 'archive',
                        label: tForms('archiveForm'),
                        onSelect: onArchive,
                    }] : []),
                    { key: 'delete', label: tForms('deleteForm'), icon: <TrashIcon />, danger: true, onSelect: onDelete },
                ]}
            />
        </div>
    );
}
