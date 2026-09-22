import { prisma } from '../lib/prisma';

// Shared by modules/clientPortal (the client's own view) and modules/forms
// (the coach's view) — lives here rather than in either module per the
// layering rule: shared logic goes down to utils/, not sideways between
// sibling modules.
export async function attachEditHistory<T extends { id: string }>(responses: T[]) {
    const ids = responses.map(r => r.id);
    if (ids.length === 0) return responses.map(r => ({ ...r, edited: false, history: [] as EditHistoryEntry[] }));

    const edits = await prisma.form_response_edits.findMany({
        where:   { response_id: { in: ids } },
        orderBy: { edited_at: 'asc' },
        select:  { response_id: true, previous_answer: true, new_answer: true, edited_at: true },
    });

    const byResponse = new Map<string, EditHistoryEntry[]>();
    for (const e of edits) {
        const list = byResponse.get(e.response_id) ?? [];
        list.push(e);
        byResponse.set(e.response_id, list);
    }

    return responses.map(r => ({
        ...r,
        edited:  (byResponse.get(r.id)?.length ?? 0) > 0,
        history: byResponse.get(r.id) ?? [],
    }));
}

type EditHistoryEntry = {
    response_id:     string;
    previous_answer: string | null;
    new_answer:      string | null;
    edited_at:       Date;
};
