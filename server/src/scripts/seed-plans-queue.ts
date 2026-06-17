/**
 * Seed the Plans Queue with demo data for a workspace.
 *
 * The Plans Queue (client: /plans-queue) is backed by `form_requests` joined to
 * `forms`, `form_questions`, `clients`, plus `form_responses` for answered ones.
 * Request status maps to the four queue lanes the UI renders:
 *
 *   DB status   → UI status     meaning
 *   ----------    -----------    ------------------------------------------
 *   pending     → awaiting       sent to client, not yet submitted
 *   scheduled   → scheduled      queued to send at a future date
 *   submitted   → need-action    client answered, coach hasn't acted
 *   reviewed    → action-done    coach has reviewed / acted
 *
 * To make the queue meaningful this script also enriches the workspace's demo
 * forms IF they are still bare stubs: it gives a form questions when it has none,
 * and sets post_action / form_type when they are still at the defaults
 * ('nothing' / 'check-in'). Existing, deliberately-configured forms are left
 * untouched, so re-running is safe.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-plans-queue.ts [slug] [count]
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-plans-queue.ts bahaa-bzns 60
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const SLUG = process.argv[2] || 'bahaa-bzns';
const COUNT = Number(process.argv[3] || 60);

const DAY = 86_400_000;

// Weighted status mix — roughly mirrors a live queue: a healthy backlog of
// answered-but-unactioned items, plus some awaiting/scheduled/done.
const STATUS_MIX: Array<{ status: string; weight: number }> = [
    { status: 'submitted', weight: 40 },  // need-action
    { status: 'reviewed',  weight: 25 },  // action-done
    { status: 'pending',   weight: 22 },  // awaiting
    { status: 'scheduled', weight: 13 },  // scheduled
];

// Question sets used only when a stub form has zero questions. Keyed by the
// post_action we want the form to drive, so answers read sensibly.
const QUESTION_SETS: Record<string, Array<{ label_en: string; label_ar: string; type: string; min?: number; max?: number; options?: string[] }>> = {
    'nutrition-plan': [
        { label_en: 'Current weight (kg)', label_ar: 'الوزن الحالي (كجم)', type: 'number' },
        { label_en: 'Target weight (kg)',  label_ar: 'الوزن المستهدف (كجم)', type: 'number' },
        { label_en: 'Dietary preference',  label_ar: 'النظام الغذائي المفضل', type: 'select', options: ['Balanced', 'Low-carb', 'High-protein', 'Vegetarian', 'Vegan'] },
        { label_en: 'Food allergies',      label_ar: 'حساسية الطعام', type: 'multiselect', options: ['None', 'Nuts', 'Dairy', 'Gluten', 'Seafood', 'Eggs'] },
        { label_en: 'Daily energy level',  label_ar: 'مستوى الطاقة اليومي', type: 'scale', min: 1, max: 10 },
        { label_en: 'Meals you usually skip', label_ar: 'الوجبات التي تتخطاها عادة', type: 'text' },
    ],
    'workout-plan': [
        { label_en: 'Training experience', label_ar: 'الخبرة التدريبية', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
        { label_en: 'Days per week available to train', label_ar: 'أيام التدريب المتاحة أسبوعياً', type: 'number' },
        { label_en: 'Available equipment', label_ar: 'المعدات المتاحة', type: 'multiselect', options: ['Bodyweight', 'Dumbbells', 'Barbell', 'Machines', 'Resistance bands'] },
        { label_en: 'Primary goal',        label_ar: 'الهدف الأساسي', type: 'select', options: ['Build muscle', 'Lose fat', 'Improve endurance', 'General fitness'] },
        { label_en: 'Current fitness level', label_ar: 'مستوى اللياقة الحالي', type: 'scale', min: 1, max: 10 },
        { label_en: 'Any injuries or limitations', label_ar: 'أي إصابات أو قيود', type: 'text' },
    ],
};

const TEXT_ANSWERS = [
    'Breakfast on busy mornings.', 'None really, I eat regularly.', 'Lunch when working late.',
    'Old knee injury, nothing serious.', 'Lower back is a bit stiff.', 'No limitations.',
    'I tend to skip dinner.', 'Recovering from a shoulder strain.',
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function pickWeighted(): string {
    const total = STATUS_MIX.reduce((s, m) => s + m.weight, 0);
    let roll = Math.random() * total;
    for (const m of STATUS_MIX) {
        roll -= m.weight;
        if (roll <= 0) return m.status;
    }
    return STATUS_MIX[0].status;
}

// Infer the demo action a stub form should drive from its title.
function inferPostAction(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('nutrition') || t.includes('diet') || t.includes('meal')) return 'nutrition-plan';
    if (t.includes('training') || t.includes('workout') || t.includes('exercise')) return 'workout-plan';
    return 'workout-plan';
}

function inferFormType(title: string): string {
    return title.toLowerCase().includes('assessment') ? 'assessment' : 'check-in';
}

// Generate a human-readable answer string for a question (form_responses.answer is TEXT).
function answerFor(q: { type: string; min_value: number | null; max_value: number | null; options: unknown; label_en: string }): string {
    const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    switch (q.type) {
        case 'scale':
            return String(randInt(q.min_value ?? 1, q.max_value ?? 10));
        case 'select':
            return opts.length ? pick(opts) : 'N/A';
        case 'multiselect': {
            if (!opts.length) return '';
            const n = randInt(1, Math.min(3, opts.length));
            const shuffled = [...opts].sort(() => Math.random() - 0.5).slice(0, n);
            return shuffled.join(', ');
        }
        case 'number': {
            const label = q.label_en.toLowerCase();
            if (label.includes('weight')) return String(randInt(55, 110));
            if (label.includes('day'))    return String(randInt(2, 6));
            return String(randInt(1, 50));
        }
        default:
            return pick(TEXT_ANSWERS);
    }
}

interface SeedForm {
    id: string;
    post_action: string;
    form_type: string;
    questions: Array<{ id: string; type: string; min_value: number | null; max_value: number | null; options: unknown; label_en: string }>;
}

// Ensure a stub form has questions + a meaningful action. Returns the ready form.
async function prepareForm(form: { id: string; title_en: string; post_action: string; form_type: string }): Promise<SeedForm> {
    let postAction = form.post_action;
    let formType = form.form_type;

    // Only override forms still at their defaults — never clobber real config.
    if (postAction === 'nothing' || formType === 'check-in') {
        postAction = postAction === 'nothing' ? inferPostAction(form.title_en) : postAction;
        formType = formType === 'check-in' ? inferFormType(form.title_en) : formType;
        await prisma.forms.update({
            where: { id: form.id },
            data: { post_action: postAction, form_type: formType, updated_at: new Date() },
        });
    }

    let questions = await prisma.form_questions.findMany({
        where: { form_id: form.id },
        select: { id: true, type: true, min_value: true, max_value: true, options: true, label_en: true },
    });

    if (questions.length === 0) {
        const set = QUESTION_SETS[postAction] ?? QUESTION_SETS['workout-plan'];
        const rows: Prisma.form_questionsCreateManyInput[] = set.map((q, i) => ({
            id: createId(),
            form_id: form.id,
            label_en: q.label_en,
            label_ar: q.label_ar,
            type: q.type,
            order_index: i,
            min_value: q.type === 'scale' ? (q.min ?? 1) : null,
            max_value: q.type === 'scale' ? (q.max ?? 10) : null,
            options: q.options ? (q.options as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        }));
        await prisma.form_questions.createMany({ data: rows });
        questions = await prisma.form_questions.findMany({
            where: { form_id: form.id },
            select: { id: true, type: true, min_value: true, max_value: true, options: true, label_en: true },
        });
        console.log(`  + seeded ${rows.length} questions for form "${form.id}"`);
    }

    return { id: form.id, post_action: postAction, form_type: formType, questions };
}

async function main() {
    if (!COUNT || COUNT < 1) throw new Error(`Invalid count: ${process.argv[3]}`);

    const workspace = await prisma.workspaces.findUnique({
        where: { slug: SLUG },
        select: { id: true, name: true },
    });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);

    const rawForms = await prisma.forms.findMany({
        where: { workspace_id: workspace.id },
        select: { id: true, title_en: true, post_action: true, form_type: true },
    });
    if (rawForms.length === 0) {
        throw new Error(`Workspace "${SLUG}" has no forms — create/seed forms before seeding the queue.`);
    }

    const clients = await prisma.clients.findMany({
        where: { workspace_id: workspace.id },
        select: { id: true },
    });
    if (clients.length === 0) {
        throw new Error(`Workspace "${SLUG}" has no clients — run seed-clients first.`);
    }

    console.log(`Preparing ${rawForms.length} forms in "${workspace.name}" (${SLUG})...`);
    const forms = await Promise.all(rawForms.map(prepareForm));

    const requests: Prisma.form_requestsCreateManyInput[] = [];
    const responses: Prisma.form_responsesCreateManyInput[] = [];
    const counts: Record<string, number> = { pending: 0, scheduled: 0, submitted: 0, reviewed: 0 };

    for (let i = 0; i < COUNT; i++) {
        const form = pick(forms);
        const client = pick(clients);
        const status = pickWeighted();
        const requestId = createId();

        // requested_at spread across the past ~60 days so the table sorts naturally.
        const requestedAt = new Date(Date.now() - randInt(0, 60) * DAY - randInt(0, DAY));
        let scheduledAt: Date | null = null;
        let submittedAt: Date | null = null;
        let actionTakenAt: Date | null = null;

        if (status === 'scheduled') {
            // Must be in the future, else activateDueScheduledRequests flips it to pending.
            scheduledAt = new Date(Date.now() + randInt(1, 21) * DAY);
        }
        if (status === 'submitted' || status === 'reviewed') {
            submittedAt = new Date(requestedAt.getTime() + randInt(1, 5) * DAY);
        }
        if (status === 'reviewed') {
            actionTakenAt = new Date(submittedAt!.getTime() + randInt(1, 3) * DAY);
        }

        requests.push({
            id: requestId,
            form_id: form.id,
            client_id: client.id,
            workspace_id: workspace.id,
            status,
            requested_at: requestedAt,
            submitted_at: submittedAt,
            scheduled_at: scheduledAt,
            action_taken_at: actionTakenAt,
            post_action: form.post_action,
        });

        // Answered requests get a response per question.
        if (status === 'submitted' || status === 'reviewed') {
            for (const q of form.questions) {
                responses.push({
                    id: createId(),
                    request_id: requestId,
                    question_id: q.id,
                    answer: answerFor(q),
                    created_at: submittedAt!,
                });
            }
        }

        counts[status]++;
    }

    await prisma.form_requests.createMany({ data: requests, skipDuplicates: true });
    if (responses.length) {
        await prisma.form_responses.createMany({ data: responses, skipDuplicates: true });
    }

    console.log(`\nSeeded ${requests.length} form_requests + ${responses.length} form_responses into "${workspace.name}" (${SLUG}).`);
    console.log(`  awaiting (pending):     ${counts.pending}`);
    console.log(`  scheduled:              ${counts.scheduled}`);
    console.log(`  need-action (submitted):${counts.submitted}`);
    console.log(`  action-done (reviewed): ${counts.reviewed}`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
