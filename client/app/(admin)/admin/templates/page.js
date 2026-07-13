'use client';

import { useRef, useState, useEffect } from 'react';
import { useFormBuilder } from '@/hooks/useFormBuilder';
import FormsPanel from '@/app/components/forms/FormsPanel';
import QuestionsPanel from '@/app/components/forms/QuestionsPanel';
import QuestionEditorPanel from '@/app/components/forms/QuestionEditorPanel';
import SaveStatusIndicator from '@/app/components/SaveStatusIndicator';
import { Button } from '@heroui/react/button';

// Super Admin "Default Templates" — the exact same 3-panel form builder coaches use,
// pointed at the global Master Form Templates instead of a workspace. No separate
// builder exists; only the basePath differs. Templates authored here are cloned into
// every new coach workspace on signup (see server lib/libraryClone.ts).
export default function DefaultTemplatesPage() {
    const [widths, setWidths] = useState([33, 34, 33]);
    const containerRef = useRef(null);

    function handleDividerMouseDown(index, e) {
        e.preventDefault();
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const startX = e.clientX;
        const startWidths = [...widths];

        function onMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            const deltaPct = (deltaX / containerWidth) * 100;
            const newWidths = [...startWidths];
            newWidths[index]     = Math.max(15, startWidths[index]     + deltaPct);
            newWidths[index + 1] = Math.max(15, startWidths[index + 1] - deltaPct);
            setWidths(newWidths);
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    const {
        forms,
        sortedForms,
        sortOrder, setSortOrder,
        selectedForm, setSelectedForm,
        questions,
        selectedQuestion, setSelectedQuestion,
        loading,
        pendingFocusFormId, setPendingFocusFormId,
        pendingFocusQuestionId, setPendingFocusQuestionId,
        isDirty, isSaving, saveStatus,
        handleSelectForm,
        handleCreateForm,
        handleEditForm,
        handleDeleteForm,
        handleActivateForm,
        handleDuplicateForm,
        handleCreateQuestion,
        handleUpdateQuestion,
        handleDeleteQuestion,
        handleReorderQuestions,
        handleSaveDraft,
    } = useFormBuilder({ basePath: '/api/admin/forms-templates' });

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        function handleClick(e) {
            if (!isDirty) return;
            const link = e.target.closest('a[href]');
            if (!link) return;
            if (link.href === window.location.href) return;
            const proceed = window.confirm('You have unsaved changes on this template. Leave without saving?');
            if (!proceed) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [isDirty]);

    return (
        <div className="flex flex-col h-screen">
            <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-foreground">Default Templates</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Assessment &amp; Check-In forms cloned into every new coach workspace.
                    </p>
                </div>
                {selectedForm && (
                    <div className="flex items-center gap-3 shrink-0">
                        <SaveStatusIndicator isDirty={isDirty} saveStatus={saveStatus} />
                        <Button
                            variant="primary"
                            isDisabled={!isDirty || isSaving}
                            onClick={async () => {
                                const result = await handleSaveDraft();
                                if (result?.blocked) window.alert(result.error);
                            }}
                        >
                            {isSaving || saveStatus === 'saving' ? 'Saving…' : 'Save'}
                        </Button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading templates…</p>
                </div>
            ) : (
                <div
                    ref={containerRef}
                    className="flex flex-1 overflow-hidden gap-0 p-3"
                    style={{ background: 'var(--background)' }}
                >
                    {/* ── Panel 1: Templates List ─────────────────────────── */}
                    <div className="flex flex-col overflow-hidden" style={{ width: `${widths[0]}%` }}>
                        <FormsPanel
                            forms={forms}
                            sortedForms={sortedForms}
                            selectedForm={selectedForm}
                            sortOrder={sortOrder}
                            setSortOrder={setSortOrder}
                            pendingFocusFormId={pendingFocusFormId}
                            setPendingFocusFormId={setPendingFocusFormId}
                            handleSelectForm={handleSelectForm}
                            handleCreateForm={handleCreateForm}
                            handleDeleteForm={handleDeleteForm}
                            handleActivateForm={handleActivateForm}
                            handleDuplicateForm={handleDuplicateForm}
                        />
                    </div>

                    {/* ── Divider 1 ───────────────────────────────────────── */}
                    <div
                        className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                        onMouseDown={(e) => handleDividerMouseDown(0, e)}
                    >
                        <div className="w-1.5 h-12 bg-primary/20 rounded-full group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
                    </div>

                    {/* ── Panel 2: Questions List ──────────────────────────── */}
                    <div className="flex flex-col overflow-hidden" style={{ width: `${widths[1]}%` }}>
                        <QuestionsPanel
                            selectedForm={selectedForm}
                            setSelectedForm={setSelectedForm}
                            questions={questions}
                            selectedQuestion={selectedQuestion}
                            setSelectedQuestion={setSelectedQuestion}
                            pendingFocusFormId={pendingFocusFormId}
                            setPendingFocusFormId={setPendingFocusFormId}
                            pendingFocusQuestionId={pendingFocusQuestionId}
                            setPendingFocusQuestionId={setPendingFocusQuestionId}
                            handleCreateQuestion={handleCreateQuestion}
                            handleUpdateQuestion={handleUpdateQuestion}
                            handleDeleteQuestion={handleDeleteQuestion}
                            handleReorderQuestions={handleReorderQuestions}
                            handleEditForm={handleEditForm}
                        />
                    </div>

                    {/* ── Divider 2 ───────────────────────────────────────── */}
                    <div
                        className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                        onMouseDown={(e) => handleDividerMouseDown(1, e)}
                    >
                        <div className="w-1.5 h-12 bg-primary/20 rounded-full group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
                    </div>

                    {/* ── Panel 3: Question Editor ─────────────────────────── */}
                    <div className="flex flex-col overflow-hidden" style={{ width: `${widths[2]}%` }}>
                        <QuestionEditorPanel
                            selectedQuestion={selectedQuestion}
                            setSelectedQuestion={setSelectedQuestion}
                            pendingFocusQuestionId={pendingFocusQuestionId}
                            setPendingFocusQuestionId={setPendingFocusQuestionId}
                            handleUpdateQuestion={handleUpdateQuestion}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
