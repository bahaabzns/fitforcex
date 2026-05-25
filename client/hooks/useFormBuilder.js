import { useState, useEffect } from "react";
import api from "@/lib/axios";

export function useFormBuilder() {

    // ── State ──────────────────────────────────────────────────────────────────

    const [forms, setForms] = useState([]);
    const [selectedForm, setSelectedForm] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState("created_desc");
    const [pendingFocusFormId, setPendingFocusFormId] = useState(null);
    const [pendingFocusQuestionId, setPendingFocusQuestionId] = useState(null);

    // ── Effects ────────────────────────────────────────────────────────────────

    useEffect(() => {
        const fetchForms = async () => {
            try {
                const res = await api.get('/api/forms');
                setForms(res.data);
            } catch (err) {
                console.error('Error fetching forms:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchForms();
    }, []);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const sortedForms = [...forms].sort((a, b) => {
        if (sortOrder === 'created_asc')  return new Date(a.created_at) - new Date(b.created_at);
        if (sortOrder === 'created_desc') return new Date(b.created_at) - new Date(a.created_at);
        if (sortOrder === 'a-z')          return (a.title_en || '').localeCompare(b.title_en || '');
        return 0;
    });

    // ── Form Handlers ──────────────────────────────────────────────────────────

    const handleSelectForm = async (form) => {
        setSelectedForm(form);
        setSelectedQuestion(null);
        try {
            const res = await api.get(`/api/forms/${form.id}/questions`);
            setQuestions(res.data);
        } catch (err) {
            console.error('Error fetching questions:', err);
            setQuestions([]);
        }
    };

    const handleCreateForm = async () => {
        try {
            const res = await api.post('/api/forms', { title_en: 'Untitled Form' });
            const newForm = { ...res.data, question_count: 0 };
            setForms(prev => [newForm, ...prev]);
            setSelectedForm(newForm);
            setQuestions([]);
            setSelectedQuestion(null);
            setPendingFocusFormId(newForm.id);
        } catch (err) {
            console.error('Error creating form:', err);
        }
    };

    const handleUpdateForm = async (id, updates) => {
        try {
            const res = await api.put(`/api/forms/${id}`, updates);
            setForms(prev => prev.map(f => f.id === id ? { ...f, ...res.data } : f));
            if (selectedForm?.id === id) setSelectedForm(prev => ({ ...prev, ...res.data }));
        } catch (err) {
            console.error('Error updating form:', err);
        }
    };

    const handleDeleteForm = async (id) => {
        try {
            await api.delete(`/api/forms/${id}`);
            setForms(prev => prev.filter(f => f.id !== id));
            if (selectedForm?.id === id) {
                setSelectedForm(null);
                setQuestions([]);
                setSelectedQuestion(null);
            }
        } catch (err) {
            console.error('Error deleting form:', err);
        }
    };

    const handleDuplicateForm = async (id) => {
        try {
            // Get source form questions then create new form + questions
            const source = forms.find(f => f.id === id);
            const qs = await api.get(`/api/forms/${id}/questions`);

            const newFormRes = await api.post('/api/forms', {
                title_en: `${source.title_en || 'Untitled Form'} (copy)`,
                title_ar: source.title_ar,
                description_en: source.description_en,
                description_ar: source.description_ar,
                postAction: source.post_action || source.postAction || 'nothing',
                formType: source.form_type || source.formType || 'check-in',
            });
            const newForm = newFormRes.data;

            // Re-create all questions
            for (const q of qs.data) {
                await api.post(`/api/forms/${newForm.id}/questions`, {
                    label_en: q.label_en, label_ar: q.label_ar,
                    type: q.type, required: q.required,
                    placeholder_en: q.placeholder_en, placeholder_ar: q.placeholder_ar,
                    options: q.options, options_ar: q.options_ar,
                    min_value: q.min_value, max_value: q.max_value,
                });
            }

            const finalRes = await api.get('/api/forms');
            setForms(finalRes.data);
        } catch (err) {
            console.error('Error duplicating form:', err);
        }
    };

    // ── Question Handlers ──────────────────────────────────────────────────────

    const handleCreateQuestion = async (type = 'text') => {
        if (!selectedForm) return;
        try {
            const res = await api.post(`/api/forms/${selectedForm.id}/questions`, {
                label_en: 'Question',
                type,
            });
            const newQ = res.data;
            setQuestions(prev => [...prev, newQ]);
            setSelectedQuestion(newQ);
            setForms(prev => prev.map(f =>
                f.id === selectedForm.id
                    ? { ...f, question_count: (f.question_count || 0) + 1 }
                    : f
            ));
            setPendingFocusQuestionId(newQ.id);
        } catch (err) {
            console.error('Error creating question:', err);
        }
    };

    const handleUpdateQuestion = async (qid, updates) => {
        if (!selectedForm) return;
        try {
            const res = await api.put(`/api/forms/${selectedForm.id}/questions/${qid}`, updates);
            const updated = res.data;
            setQuestions(prev => prev.map(q => q.id === qid ? updated : q));
            if (selectedQuestion?.id === qid) setSelectedQuestion(updated);
        } catch (err) {
            console.error('Error updating question:', err);
        }
    };

    const handleDeleteQuestion = async (qid) => {
        if (!selectedForm) return;
        try {
            await api.delete(`/api/forms/${selectedForm.id}/questions/${qid}`);
            setQuestions(prev => prev.filter(q => q.id !== qid));
            if (selectedQuestion?.id === qid) setSelectedQuestion(null);
            setForms(prev => prev.map(f =>
                f.id === selectedForm.id
                    ? { ...f, question_count: Math.max(0, (f.question_count || 1) - 1) }
                    : f
            ));
        } catch (err) {
            console.error('Error deleting question:', err);
        }
    };

    const handleReorderQuestions = async (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const reordered = [...questions];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        // Optimistic update
        setQuestions(reordered);
        try {
            await api.put(`/api/forms/${selectedForm.id}/questions/reorder`, {
                order: reordered.map((q, i) => ({ id: q.id, order_index: i })),
            });
        } catch (err) {
            console.error('Error reordering questions:', err);
        }
    };

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
        handleSelectForm,
        handleCreateForm,
        handleUpdateForm,
        handleDeleteForm,
        handleDuplicateForm,
        handleCreateQuestion,
        handleUpdateQuestion,
        handleDeleteQuestion,
        handleReorderQuestions,
    };
}
