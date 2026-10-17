"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFormBuilder } from "@/hooks/useFormBuilder";
import FormsPanel from "@/app/components/forms/FormsPanel";
import QuestionsPanel from "@/app/components/forms/QuestionsPanel";
import QuestionEditorPanel from "@/app/components/forms/QuestionEditorPanel";
import SaveStatusIndicator from "@/app/components/SaveStatusIndicator";
import VersionBadge from "@/app/components/forms/VersionBadge";
import { Button } from "@heroui/react/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMobilePanels } from "@/hooks/useMobilePanels";
import { useSheetUi } from "@/hooks/useSheetUi";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";

export default function FormsPage() {
    const tNav = useTranslations("nav");
    usePageTitle(tNav('forms'));
    const [widths, setWidths] = useState([33, 34, 33]);
    const containerRef = useRef(null);
    // Below this width three side-by-side columns get cramped, so the deepest
    // panel (question editor) switches to an overlay drawer. Wide layout unchanged.
    const isNarrow = useMediaQuery("(max-width: 1279px)");
    // Phone: one panel per screen (forms → questions → question editor).
    const isMobile = useMediaQuery("(max-width: 767px)");
    useSheetUi();

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
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
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
        handleArchiveForm,
        handleActivateForm,
        handleDuplicateForm,
        handleImportGoogleForm,
        handleCreateQuestion,
        handleUpdateQuestion,
        handleDeleteQuestion,
        handleReorderQuestions,
        handleSaveDraft,
        handleGetMetricPreview,
        handleTrackAsMetric,
    } = useFormBuilder();

    const { goToStep: goToMobileStep, swipeHandlers, panelStyle } = useMobilePanels({
        isMobile,
        maxStep: selectedQuestion ? 2 : selectedForm ? 1 : 0,
    });

    // Builder Save Workflow — tab close/refresh guard. In-app navigation away
    // from this page (sidebar links etc.) is intercepted the same way
    // clients/[id]/layout.js already does for the training/nutrition
    // builders: a document-level click-intercept on outgoing <a> clicks.
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        function handleClick(e) {
            if (!isDirty) return;
            const link = e.target.closest("a[href]");
            if (!link) return;
            if (link.href === window.location.href) return;
            const proceed = window.confirm("You have unsaved changes on this form. Leave without saving?");
            if (!proceed) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [isDirty]);

    if (loading) {
        return (
            <div className="flex flex-1 h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading forms…</p>
            </div>
        );
    }

    // Rendered either as the third column (wide), inside the overlay drawer
    // (narrow) or as its own screen (phone). Defined once so the prop list
    // isn't duplicated across branches.
    const editorPanel = (
        <QuestionEditorPanel
            selectedQuestion={selectedQuestion}
            setSelectedQuestion={setSelectedQuestion}
            pendingFocusQuestionId={pendingFocusQuestionId}
            setPendingFocusQuestionId={setPendingFocusQuestionId}
            handleUpdateQuestion={handleUpdateQuestion}
            isDirty={isDirty}
            handleGetMetricPreview={handleGetMetricPreview}
            handleTrackAsMetric={handleTrackAsMetric}
        />
    );

    return (
        <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
            {selectedForm && (
                <div className="flex items-center justify-between gap-3 px-3 pt-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <VersionBadge
                            versionNumber={selectedForm.current_version_number}
                            sealedAt={selectedForm.current_version_sealed_at}
                        />
                        <SaveStatusIndicator isDirty={isDirty} saveStatus={saveStatus} />
                    </div>
                    <Button
                        variant="primary"
                        isDisabled={!isDirty || isSaving}
                        onClick={async () => {
                            const result = await handleSaveDraft();
                            if (result?.blocked) window.alert(result.error);
                        }}
                    >
                        {isSaving || saveStatus === "saving" ? "Saving…" : "Save"}
                    </Button>
                </div>
            )}
            <div className="shrink-0 px-3 pt-3">
                <TriggerInsightBanner
                    triggerEvent="first_form_created"
                    checkUrl="/api/insights/prompts/for-trigger/first_form_created"
                    respondUrlPrefix="/api/insights/prompts"
                    dismissUrlPrefix="/api/insights/prompts"
                />
            </div>
            <div
                ref={containerRef}
                className={`flex flex-1 min-h-0 overflow-hidden bg-background p-3 ${isNarrow && !isMobile ? "gap-2" : "gap-0"}`}
                {...swipeHandlers}
                // The track is moved with transforms, never scrolled. Anything that scrolls this
                // overflow-hidden box (a focused off-screen field) would offset every panel.
                onScroll={(e) => { if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0; }}
            >
                {/* ── Panel 1: Forms List ─────────────────────────────── */}
                <div
                    className={`flex flex-col overflow-hidden ${isNarrow ? (isMobile ? "w-full shrink-0" : "w-[34%] shrink-0") : ""}`}
                    style={isMobile ? panelStyle : isNarrow ? undefined : { width: `${widths[0]}%` }}
                >
                    <FormsPanel
                        forms={forms}
                        sortedForms={sortedForms}
                        selectedForm={selectedForm}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        pendingFocusFormId={pendingFocusFormId}
                        setPendingFocusFormId={setPendingFocusFormId}
                        handleSelectForm={(form) => { handleSelectForm(form); goToMobileStep(1); }}
                        handleCreateForm={handleCreateForm}
                        handleDeleteForm={handleDeleteForm}
                        handleArchiveForm={handleArchiveForm}
                        handleActivateForm={handleActivateForm}
                        handleDuplicateForm={handleDuplicateForm}
                        handleImportGoogleForm={handleImportGoogleForm}
                    />
                </div>

                {/* ── Divider 1 ───────────────────────────────────────── */}
                {!isNarrow && (
                <div
                    className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                    onMouseDown={(e) => handleDividerMouseDown(0, e)}
                >
                    <div className="w-1.5 h-12 bg-primary/20 rounded-full group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
                </div>
                )}


                {/* ── Panel 2: Questions List ──────────────────────────── */}
                <div
                    className={`flex flex-col overflow-hidden min-w-0 ${isNarrow ? (isMobile ? "w-full shrink-0" : "flex-1") : ""}`}
                    style={isMobile ? panelStyle : isNarrow ? undefined : { width: `${widths[1]}%` }}
                >
                    <QuestionsPanel
                        selectedForm={selectedForm}
                        setSelectedForm={setSelectedForm}
                        questions={questions}
                        selectedQuestion={selectedQuestion}
                        setSelectedQuestion={(question) => { setSelectedQuestion(question); if (question) goToMobileStep(2); }}
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
                {!isNarrow && (
                <div
                    className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                    onMouseDown={(e) => handleDividerMouseDown(1, e)}
                >
                    <div className="w-1.5 h-12 bg-primary/20 rounded-full group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
                </div>
                )}

                {/* ── Panel 3: Question Editor ─────────────────────────── */}
                {!isNarrow && (
                    <div
                        className="flex flex-col overflow-hidden"
                        style={{ width: `${widths[2]}%` }}
                    >
                        {editorPanel}
                    </div>
                )}

                {/* Phone: editor is its own screen, same as the other panels */}
                {isMobile && selectedQuestion && (
                    <div style={panelStyle} className="w-full shrink-0 flex flex-col min-w-0 overflow-hidden">
                        {editorPanel}
                    </div>
                )}

                {/* Narrow: editor as an overlay drawer */}
                {isNarrow && !isMobile && selectedQuestion && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedQuestion(null)} />
                        <div className="relative h-full w-full max-w-md p-2 flex flex-col">
                            {editorPanel}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
