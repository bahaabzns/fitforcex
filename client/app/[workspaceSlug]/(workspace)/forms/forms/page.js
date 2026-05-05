"use client";

import { useRef, useState } from "react";
import { useFormBuilder } from "@/hooks/useFormBuilder";
import FormsPanel from "@/app/components/forms/FormsPanel";
import QuestionsPanel from "@/app/components/forms/QuestionsPanel";
import QuestionEditorPanel from "@/app/components/forms/QuestionEditorPanel";

export default function FormsPage() {
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
        handleSelectForm,
        handleCreateForm,
        handleUpdateForm,
        handleDeleteForm,
        handleDuplicateForm,
        handleCreateQuestion,
        handleUpdateQuestion,
        handleDeleteQuestion,
        handleReorderQuestions,
    } = useFormBuilder();

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-60px)] items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading forms…</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="flex h-[calc(100vh-60px)] overflow-hidden gap-0 p-3"
            style={{ background: "var(--background)" }}
        >
            {/* ── Panel 1: Forms List ─────────────────────────────── */}
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[0]}%` }}
            >
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
                    handleUpdateForm={handleUpdateForm}
                    handleDeleteForm={handleDeleteForm}
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
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[1]}%` }}
            >
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
                    handleUpdateForm={handleUpdateForm}
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
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[2]}%` }}
            >
                <QuestionEditorPanel
                    selectedQuestion={selectedQuestion}
                    setSelectedQuestion={setSelectedQuestion}
                    pendingFocusQuestionId={pendingFocusQuestionId}
                    setPendingFocusQuestionId={setPendingFocusQuestionId}
                    handleUpdateQuestion={handleUpdateQuestion}
                />
            </div>
        </div>
    );
}
