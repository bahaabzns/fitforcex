"use client";

import ImagePreview from "@/app/components/ImagePreview";

// Shared answer viewer — rendering is always decided by the question's type
// (returned by the API alongside each response), never guessed from the
// answer string. A small number of legacy responses may have no question
// (question_id was NULL before Forms Versioning) — those have no `type` and
// safely fall through to the plain-text branch below rather than being
// content-sniffed. Used by both the coach's client-forms detail view and the
// Plans Queue answer preview — same response shape ({ answer, type,
// metric_type }) in both places.
export function isImageAnswer(r) {
    return r.type === 'metric' && r.metric_type === 'image';
}

// "attachment" answers are presented by file kind, not treated as one
// generic blob — the kind here is a presentation choice about an answer
// already known (by type) to be an attachment, not a guess about the
// question's type, so this doesn't reintroduce the isImageUrl anti-pattern
// it replaced. See client/app/components/forms/questionTypes.js's
// ATTACHMENT_CATEGORIES for the categories a coach can configure.
export function attachmentKind(url) {
    if (!url || typeof url !== 'string') return 'file';
    const path = url.split('?')[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|heic)$/.test(path)) return 'image';
    if (path.endsWith('.pdf')) return 'pdf';
    return 'file';
}

export function attachmentFileName(url) {
    try {
        return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file');
    } catch {
        return 'file';
    }
}

export default function AnswerBody({ response: r }) {
    if (isImageAnswer(r)) {
        return (
            <a href={r.answer} target="_blank" rel="noopener noreferrer" className="block">
                <img src={r.answer} alt="" className="w-full rounded-lg object-contain max-h-96 bg-black/5" />
            </a>
        );
    }

    if (r.type === 'attachment' && r.answer) {
        const kind = attachmentKind(r.answer);
        if (kind === 'image') {
            return (
                <a href={r.answer} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={r.answer} alt="" className="w-full rounded-lg object-contain max-h-96 bg-black/5" />
                </a>
            );
        }
        if (kind === 'pdf') {
            return (
                <ImagePreview
                    src={r.answer}
                    isPdf
                    title={attachmentFileName(r.answer)}
                    triggerClassName="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:border-primary/40 transition-colors"
                >
                    <span className="text-xl shrink-0">📄</span>
                    <span className="flex-1 text-sm text-foreground truncate text-left">{attachmentFileName(r.answer)}</span>
                    <span className="text-xs text-primary shrink-0">Open</span>
                </ImagePreview>
            );
        }
        return (
            <a href={r.answer} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:border-primary/40 transition-colors">
                <span className="text-xl shrink-0">📎</span>
                <span className="flex-1 text-sm text-foreground truncate">{attachmentFileName(r.answer)}</span>
                <span className="text-xs text-primary shrink-0">Open</span>
            </a>
        );
    }

    return (
        <p className="text-sm text-foreground whitespace-pre-wrap">
            {r.answer || <span className="text-muted-foreground italic">—</span>}
        </p>
    );
}
