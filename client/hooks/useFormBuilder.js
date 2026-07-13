import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/axios";

function makeTempId() {
    return `tmp-q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// `basePath` lets the same builder drive either the coach's workspace forms
// (default) or the Super Admin's Master Form Templates (/api/admin/forms-templates).
// The endpoint shape is identical, so one hook + the shared panels serve both.
//
// Builder Save Workflow (Phase 2) — the builder edits everything (form
// metadata AND questions) locally first; nothing hits the server until
// handleSaveDraft fires. This mirrors useTrainingPlan.js's local-edit +
// explicit-save + dirty-Set + saveStatus shape. See
// server/src/modules/forms/forms.controller.ts's saveDraft for why this is a
// single batched request rather than replaying the old per-field calls: a
// version fork (resolveWritableVersion) reassigns every question a fresh id,
// and only the server has the map needed to translate that safely — doing
// the whole diff (deletes/updates/creates + form metadata) in one call
// sidesteps client-side id reconciliation entirely.
export function useFormBuilder({ basePath = '/api/forms' } = {}) {

    // ── State ──────────────────────────────────────────────────────────────────

    const [forms, setForms] = useState([]);
    const [selectedForm, setSelectedForm] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState("created_desc");
    const [pendingFocusFormId, setPendingFocusFormId] = useState(null);
    const [pendingFocusQuestionId, setPendingFocusQuestionId] = useState(null);

    const [dirtyFormIds, setDirtyFormIds] = useState(() => new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState("idle");
    const saveStatusTimeoutRef = useRef(null);

    // Only meaningful for the currently selected form — questions aren't
    // preloaded for every form (fetched on demand in handleSelectForm), so
    // question-level dirtiness can't be tracked per-form the way metadata is.
    const [deletedQuestionIds, setDeletedQuestionIds] = useState([]);
    const deletedQuestionsCacheRef = useRef(new Map()); // id -> full question object, for restoring on a blocked delete

    const isDirty = selectedForm ? dirtyFormIds.has(String(selectedForm.id)) : dirtyFormIds.size > 0;

    const markFormDirty = useCallback((id) => {
        if (!id) return;
        setDirtyFormIds((prev) => {
            const next = new Set(prev);
            next.add(String(id));
            return next;
        });
        setSaveStatus("idle");
    }, []);

    const clearFormDirty = useCallback((id) => {
        if (!id) return;
        setDirtyFormIds((prev) => {
            const next = new Set(prev);
            next.delete(String(id));
            return next;
        });
    }, []);

    // ── Effects ────────────────────────────────────────────────────────────────

    useEffect(() => {
        const fetchForms = async () => {
            try {
                const res = await api.get(basePath);
                setForms(res.data);
            } catch (err) {
                console.error('Error fetching forms:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchForms();
    }, [basePath]);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const sortedForms = [...forms].sort((a, b) => {
        if (sortOrder === 'created_asc')  return new Date(a.created_at) - new Date(b.created_at);
        if (sortOrder === 'created_desc') return new Date(b.created_at) - new Date(a.created_at);
        if (sortOrder === 'a-z')          return (a.title_en || '').localeCompare(b.title_en || '');
        return 0;
    });

    // ── Form Handlers ──────────────────────────────────────────────────────────

    const resetQuestionDraftState = () => {
        setDeletedQuestionIds([]);
        deletedQuestionsCacheRef.current = new Map();
    };

    const handleSelectForm = async (form) => {
        if (selectedForm && dirtyFormIds.has(String(selectedForm.id)) && selectedForm.id !== form.id) {
            const proceed = window.confirm('You have unsaved changes on this form. Discard them and switch forms?');
            if (!proceed) return;
            clearFormDirty(selectedForm.id);
        }
        resetQuestionDraftState();
        setSelectedForm(form);
        setSelectedQuestion(null);
        try {
            const res = await api.get(`${basePath}/${form.id}/questions`);
            setQuestions(res.data);
        } catch (err) {
            console.error('Error fetching questions:', err);
            setQuestions([]);
        }
    };

    const handleCreateForm = async () => {
        if (selectedForm && dirtyFormIds.has(String(selectedForm.id))) {
            const proceed = window.confirm('You have unsaved changes on this form. Discard them and create a new form?');
            if (!proceed) return;
            clearFormDirty(selectedForm.id);
        }
        try {
            const res = await api.post(basePath, { title_en: 'Untitled Form' });
            const newForm = { ...res.data, question_count: 0 };
            setForms(prev => [newForm, ...prev]);
            setSelectedForm(newForm);
            resetQuestionDraftState();
            setQuestions([]);
            setSelectedQuestion(null);
            setPendingFocusFormId(newForm.id);
        } catch (err) {
            console.error('Error creating form:', err);
        }
    };

    // Buffered — used by both the list-item inline rename (FormsPanel) and
    // the open builder's metadata fields (QuestionsPanel). Local only; goes
    // out on the next handleSaveDraft.
    const handleEditForm = (id, updates) => {
        setForms(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        if (selectedForm?.id === id) setSelectedForm(prev => ({ ...prev, ...updates }));
        markFormDirty(id);
    };

    const handleDeleteForm = async (id) => {
        try {
            await api.delete(`${basePath}/${id}`);
            setForms(prev => prev.filter(f => f.id !== id));
            clearFormDirty(id);
            if (selectedForm?.id === id) {
                setSelectedForm(null);
                setQuestions([]);
                setSelectedQuestion(null);
                resetQuestionDraftState();
            }
            return { ok: true };
        } catch (err) {
            if (err?.response?.status === 409) {
                // Form has client history — archiving (not deleting) is the
                // sanctioned path. Let the caller show an archive prompt.
                return { ok: false, blocked: true, submissionCount: err.response.data?.submissionCount ?? 0 };
            }
            console.error('Error deleting form:', err);
            return { ok: false, blocked: false };
        }
    };

    const handleArchiveForm = async (id) => {
        try {
            const res = await api.put(`${basePath}/${id}`, { status: 'archived' });
            setForms(prev => prev.map(f => f.id === id ? { ...f, ...res.data } : f));
            if (selectedForm?.id === id) setSelectedForm(prev => ({ ...prev, ...res.data }));
            // Forms Versioning Phase 5/post-review fix — the backend only sets
            // this when the form is a package default; the caller decides how
            // to display it (see FormsPanel.js).
            return { ok: true, warning: res.data?.warning };
        } catch (err) {
            console.error('Error archiving form:', err);
            return { ok: false };
        }
    };

    const handleDuplicateForm = async (id) => {
        try {
            // Get source form questions then create new form + questions
            const source = forms.find(f => f.id === id);
            const qs = await api.get(`${basePath}/${id}/questions`);

            const newFormRes = await api.post(basePath, {
                title_en: `${source.title_en || 'Untitled Form'} (copy)`,
                title_ar: source.title_ar,
                description_en: source.description_en,
                description_ar: source.description_ar,
                postAction: source.post_action || source.postAction || 'nothing',
                formType: source.form_type || source.formType || 'check-in',
            });
            const newForm = newFormRes.data;

            // Re-create all questions (metric_id carried over so tracking is preserved)
            for (const q of qs.data) {
                await api.post(`${basePath}/${newForm.id}/questions`, {
                    label_en: q.label_en, label_ar: q.label_ar,
                    type: q.type, required: q.required,
                    placeholder_en: q.placeholder_en, placeholder_ar: q.placeholder_ar,
                    options: q.options, options_ar: q.options_ar,
                    min_value: q.min_value, max_value: q.max_value,
                    metric_id: q.metric_id || null,
                });
            }

            const finalRes = await api.get(basePath);
            setForms(finalRes.data);
        } catch (err) {
            console.error('Error duplicating form:', err);
        }
    };

    // Used only by handleTrackAsMetric below (an immediate, non-buffered
    // action) to pick up fresh ids after a version fork.
    const refetchQuestions = async () => {
        if (!selectedForm) return;
        try {
            const res = await api.get(`${basePath}/${selectedForm.id}/questions`);
            setQuestions(res.data);
        } catch (err) {
            console.error('Error refetching questions:', err);
        }
    };

    // ── Question Handlers (all local/buffered — see module doc comment) ────────

    const handleCreateQuestion = (type = 'text') => {
        if (!selectedForm) return;
        const newQ = {
            id: makeTempId(),
            form_version_id: selectedForm.current_version_id,
            label_en: 'Question',
            label_ar: null,
            type,
            required: false,
            order_index: questions.length,
            options: ['select', 'multiselect'].includes(type) ? [] : null,
            options_ar: null,
            placeholder_en: null,
            placeholder_ar: null,
            min_value: type === 'scale' ? 1 : null,
            max_value: type === 'scale' ? 10 : null,
            metric_id: null,
        };
        setQuestions(prev => [...prev, newQ]);
        setForms(prev => prev.map(f =>
            f.id === selectedForm.id ? { ...f, question_count: (f.question_count || 0) + 1 } : f
        ));
        setSelectedQuestion(newQ);
        setPendingFocusQuestionId(newQ.id);
        markFormDirty(selectedForm.id);
    };

    const handleUpdateQuestion = (qid, updates) => {
        if (!selectedForm) return;
        setQuestions(prev => prev.map(q => q.id === qid ? { ...q, ...updates } : q));
        if (selectedQuestion?.id === qid) setSelectedQuestion(prev => ({ ...prev, ...updates }));
        markFormDirty(selectedForm.id);
    };

    const handleDeleteQuestion = (qid) => {
        if (!selectedForm) return { ok: false };
        const target = questions.find(q => q.id === qid);
        if (!target) return { ok: false };

        setQuestions(prev => prev.filter(q => q.id !== qid));
        setForms(prev => prev.map(f =>
            f.id === selectedForm.id ? { ...f, question_count: Math.max(0, (f.question_count || 1) - 1) } : f
        ));
        if (selectedQuestion?.id === qid) setSelectedQuestion(null);

        // Deleting a question that has recorded answers is blocked at save
        // time (server-side, see forms.controller.ts's saveDraft) rather
        // than here — we no longer have a synchronous round-trip per delete
        // to check up front. Cache the full row so a blocked save can put it
        // back exactly as it was.
        if (!String(qid).startsWith('tmp-q-')) {
            deletedQuestionsCacheRef.current.set(qid, target);
            setDeletedQuestionIds(prev => [...prev, qid]);
        }
        markFormDirty(selectedForm.id);
        return { ok: true };
    };

    const handleReorderQuestions = (fromIndex, toIndex) => {
        if (fromIndex === toIndex || !selectedForm) return;
        const reordered = [...questions];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        setQuestions(reordered);
        markFormDirty(selectedForm.id);
    };

    // ── Track as Metric (Phase 4) — immediate server calls, not buffered ───────
    // like the rest of the builder. Backfilling history is a deliberate,
    // one-off action with its own confirm step (the preview count), not
    // something that should wait for — or get silently bundled into — the
    // next unrelated Save. Callers gate this on `!isDirty` (see
    // QuestionEditorPanel.js) so a version fork here can never invalidate ids
    // an unsaved local edit is still holding.

    const handleGetMetricPreview = async (qid) => {
        if (!selectedForm) return { count: 0, convertible: false };
        try {
            const res = await api.get(`${basePath}/${selectedForm.id}/questions/${qid}/metric-preview`);
            return res.data;
        } catch (err) {
            console.error('Error fetching metric tracking preview:', err);
            return { count: 0, convertible: false };
        }
    };

    const handleTrackAsMetric = async (qid, metricId) => {
        if (!selectedForm) return { success: false };
        try {
            const res = await api.post(`${basePath}/${selectedForm.id}/questions/${qid}/track-as-metric`, { metric_id: metricId });
            const { question: updated, backfilledCount, versionChanged } = res.data;
            if (versionChanged) {
                await refetchQuestions();
            } else {
                setQuestions(prev => prev.map(q => q.id === qid ? updated : q));
            }
            if (selectedQuestion?.id === qid) setSelectedQuestion(updated);
            return { success: true, backfilledCount };
        } catch (err) {
            console.error('Error tracking question as metric:', err);
            return { success: false, error: err?.response?.data?.error };
        }
    };

    // ── Save ─────────────────────────────────────────────────────────────────

    const handleSaveDraft = useCallback(async () => {
        if (!selectedForm || isSaving || !isDirty) return { success: false };
        try {
            setIsSaving(true);
            setSaveStatus("saving");

            const res = await api.post(`${basePath}/${selectedForm.id}/save-draft`, {
                form: {
                    title_en: selectedForm.title_en,
                    title_ar: selectedForm.title_ar,
                    description_en: selectedForm.description_en,
                    description_ar: selectedForm.description_ar,
                    postAction: selectedForm.postAction || selectedForm.post_action,
                    formType: selectedForm.formType || selectedForm.form_type,
                },
                questions: questions.map(q => ({
                    id: String(q.id).startsWith('tmp-q-') ? null : q.id,
                    label_en: q.label_en, label_ar: q.label_ar,
                    type: q.type, required: q.required,
                    placeholder_en: q.placeholder_en, placeholder_ar: q.placeholder_ar,
                    options: q.options, options_ar: q.options_ar,
                    min_value: q.min_value, max_value: q.max_value,
                    metric_id: q.metric_id || null,
                })),
                deletedIds: deletedQuestionIds,
            });

            const { form: savedForm, questions: freshQuestions, versionChanged } = res.data;
            const mergedForm = { ...selectedForm, ...savedForm, question_count: freshQuestions.length };
            setForms(prev => prev.map(f => f.id === selectedForm.id ? mergedForm : f));
            setSelectedForm(mergedForm);
            setQuestions(freshQuestions);
            if (selectedQuestion) {
                const stillThere = freshQuestions.find(q =>
                    q.label_en === selectedQuestion.label_en && q.order_index === selectedQuestion.order_index
                );
                setSelectedQuestion(stillThere || null);
            }
            resetQuestionDraftState();
            clearFormDirty(selectedForm.id);
            setSaveStatus("saved");
            if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus("idle");
                saveStatusTimeoutRef.current = null;
            }, 1800);

            return { success: true, versionChanged };
        } catch (err) {
            setSaveStatus("idle");
            if (err?.response?.status === 409 && err.response.data?.blockedQuestionIds) {
                // Restore whichever deleted questions the server refused to
                // drop (recorded answers) so nothing is silently lost, then
                // let the caller show the message.
                const blocked = new Set(err.response.data.blockedQuestionIds);
                const restored = [];
                for (const id of blocked) {
                    const cached = deletedQuestionsCacheRef.current.get(id);
                    if (cached) restored.push(cached);
                }
                if (restored.length > 0) {
                    setQuestions(prev => [...prev, ...restored].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
                    setDeletedQuestionIds(prev => prev.filter(id => !blocked.has(id)));
                }
                return { success: false, blocked: true, error: err.response.data?.error };
            }
            console.error('Error saving form draft:', err);
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    }, [basePath, selectedForm, questions, deletedQuestionIds, isSaving, isDirty, selectedQuestion, clearFormDirty]);

    return {
        forms, setForms,
        sortedForms,
        sortOrder, setSortOrder,
        selectedForm, setSelectedForm,
        questions, setQuestions,
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
        handleDuplicateForm,
        handleCreateQuestion,
        handleUpdateQuestion,
        handleDeleteQuestion,
        handleReorderQuestions,
        handleSaveDraft,
        handleGetMetricPreview,
        handleTrackAsMetric,
    };
}
