/**
 * Seed messenger threads + messages AND form submissions for all clients
 * in a workspace that do not already have them.
 *
 * Threads & messages:
 *   - One thread per client (skipped if it already exists).
 *   - 4–10 messages per thread, alternating between team and client.
 *   - ~60% of client messages are left unread (no read_by_team_at).
 *   - Timestamps spread over the past 30 days, oldest first.
 *
 * Form submissions (form_requests + form_responses):
 *   - Requires at least one published form in the workspace.
 *   - If none exist, 2 minimal forms are created automatically.
 *   - Each client gets 1–3 form requests across the four status lanes
 *     (pending, scheduled, submitted, reviewed).
 *   - Submitted/reviewed requests get one answer per question.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-chats-forms.ts [slug]
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-chats-forms.ts test1
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();
const SLUG = process.argv[2] || 'test1';
const DAY  = 86_400_000;
const MIN  = 60_000;

// ── Message bodies ────────────────────────────────────────────────────────────

const TEAM_OPENERS = [
    'Hey! Just checking in — how has this week been going for you?',
    'Hi! I reviewed your latest check-in and you\'re making great progress.',
    'Good morning! Your training plan has been updated — take a look when you get a chance.',
    'Just a quick note: remember to log your workouts so I can track your progress properly.',
    'Hi there! I\'ve adjusted your nutrition targets for the coming week based on your last results.',
    'How are you feeling after the new training split? Let me know if anything feels off.',
    'Your meal plan is ready! Let me know if you have any questions about the portions.',
];

const CLIENT_REPLIES = [
    'Thanks coach! Feeling great, the new plan is working well.',
    'I had a rough week at work but managed to hit 4 sessions.',
    'Got it! Will check the updated plan now.',
    'Noted. I\'ll make sure to log everything from tomorrow.',
    'The new split feels harder but I can tell I\'m progressing.',
    'I have a question about the pre-workout meal — can I swap the rice for oats?',
    'This week was tough. Missed one session but kept the nutrition on track.',
    'Feeling stronger already! Weight is down 1.5 kg this month.',
    'Yes, I noticed the calorie change. Should I adjust my portions for rest days too?',
    'Coach, I\'ve been struggling with sleep. Could that be affecting my recovery?',
];

const TEAM_FOLLOWUPS = [
    'That\'s great to hear — keep it up!',
    'Four sessions is solid given your schedule. Don\'t stress about the missed one.',
    'Of course — oats are a fine swap, same amount by weight.',
    'Sleep is definitely a factor. Try to get 7–8 hours and we\'ll reassess next week.',
    'Yes, lower your carbs by about 20 g on rest days.',
    'Perfect! Let\'s aim for the same consistency next week.',
    'That\'s a great result — keep logging and we\'ll push for another 1 kg next month.',
    'Totally understandable. Just get back on track tomorrow, no need to compensate.',
];

const CLIENT_LASTS = [
    'Will do, thanks!',
    'Sounds good coach.',
    'Perfect, thanks for the quick reply!',
    'Got it, appreciate it!',
    'I\'ll give it a try.',
    'Thanks, that makes sense.',
];

// ── Form question sets (only used when creating stub forms) ───────────────────

const FORM_TEMPLATES: Array<{
    title: string;
    type: 'assessment' | 'check-in';
    post_action: string;
    questions: Array<{ label_en: string; type: string; min?: number; max?: number; options?: string[] }>;
}> = [
    {
        title:       'Weekly Check-In',
        type:        'check-in',
        post_action: 'nothing',
        questions: [
            { label_en: 'How many training sessions did you complete?', type: 'number' },
            { label_en: 'Rate your energy levels this week (1–10)', type: 'scale', min: 1, max: 10 },
            { label_en: 'How well did you stick to your nutrition plan?', type: 'select', options: ['Perfectly', 'Mostly', 'Partially', 'Poorly'] },
            { label_en: 'Current weight (kg)', type: 'number' },
            { label_en: 'Any issues or injuries to report?', type: 'text' },
        ],
    },
    {
        title:       'Initial Assessment',
        type:        'assessment',
        post_action: 'workout-plan',
        questions: [
            { label_en: 'Training experience level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
            { label_en: 'Primary fitness goal', type: 'select', options: ['Build muscle', 'Lose fat', 'Improve endurance', 'General fitness'] },
            { label_en: 'Days available to train per week', type: 'number' },
            { label_en: 'Any injuries or physical limitations', type: 'text' },
            { label_en: 'Current fitness level (1–10)', type: 'scale', min: 1, max: 10 },
        ],
    },
];

const TEXT_ANSWERS = [
    'No issues to report.',
    'Slight knee soreness after leg day, nothing serious.',
    'Old shoulder injury but manageable.',
    'Feeling good overall.',
    'Skipped breakfast twice but otherwise fine.',
    'Recovering from a cold, energy was lower than usual.',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function answerFor(q: { type: string; min_value: number | null; max_value: number | null; options: unknown; label_en: string }): string {
    const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    const label = q.label_en.toLowerCase();
    switch (q.type) {
        case 'scale':   return String(randInt(q.min_value ?? 1, q.max_value ?? 10));
        case 'select':  return opts.length ? pick(opts) : 'N/A';
        case 'multiselect': {
            if (!opts.length) return '';
            return [...opts].sort(() => Math.random() - 0.5).slice(0, randInt(1, Math.min(3, opts.length))).join(', ');
        }
        case 'number':
            if (label.includes('weight')) return String(randInt(55, 110));
            if (label.includes('session') || label.includes('day')) return String(randInt(2, 6));
            return String(randInt(1, 50));
        default:
            return pick(TEXT_ANSWERS);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const workspace = await prisma.workspaces.findUnique({
        where:  { slug: SLUG },
        select: { id: true, name: true, owner_id: true },
    });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);
    const wsId    = workspace.id;
    const ownerId = workspace.owner_id;
    console.log(`\nTarget workspace: "${workspace.name}" (${SLUG})\n`);

    // All clients in workspace
    const clients = await prisma.clients.findMany({
        where:   { workspace_id: wsId, deleted_at: null },
        select:  { id: true, fname: true, lname: true },
    });
    if (clients.length === 0) throw new Error('No clients found — run seed-full-clients first.');
    console.log(`Found ${clients.length} clients.`);

    // ── Threads & messages ────────────────────────────────────────────────────

    // Existing threads (skip clients already wired up)
    const existingThreads = await prisma.threads.findMany({
        where:  { workspace_id: wsId },
        select: { client_id: true },
    });
    const hasThread = new Set(existingThreads.map(t => t.client_id));
    const newClients = clients.filter(c => !hasThread.has(c.id));
    console.log(`  ${newClients.length} clients need threads (${hasThread.size} already have one).`);

    const threadRows:  Prisma.threadsCreateManyInput[]  = [];
    const messageRows: Prisma.messagesCreateManyInput[] = [];

    for (const client of newClients) {
        const threadId  = createId();
        const threadAt  = new Date(Date.now() - randInt(1, 30) * DAY);

        threadRows.push({
            id:           threadId,
            workspace_id: wsId,
            client_id:    client.id,
            status:       'open',
            created_at:   threadAt,
            updated_at:   threadAt,
        });

        // Build a short conversation (4–10 messages) with advancing timestamps
        const msgCount = randInt(4, 10);
        let   cursor   = threadAt.getTime();

        // Pattern: team opener → client reply → optional follow-up pairs → maybe a client last
        const bodies: Array<{ type: 'team' | 'client'; body: string }> = [];
        bodies.push({ type: 'team',   body: pick(TEAM_OPENERS) });
        bodies.push({ type: 'client', body: pick(CLIENT_REPLIES) });
        while (bodies.length < msgCount - 1) {
            bodies.push({ type: 'team',   body: pick(TEAM_FOLLOWUPS) });
            if (bodies.length < msgCount) {
                bodies.push({ type: 'client', body: pick(CLIENT_REPLIES) });
            }
        }
        if (bodies.length < msgCount) {
            bodies.push({ type: 'client', body: pick(CLIENT_LASTS) });
        }

        for (const msg of bodies.slice(0, msgCount)) {
            cursor += randInt(5, 90) * MIN;
            const sentAt    = new Date(cursor);
            const isClient  = msg.type === 'client';
            const isUnread  = isClient && Math.random() < 0.6;

            messageRows.push({
                id:                 createId(),
                thread_id:          threadId,
                sender_type:        msg.type,
                sender_id:          isClient ? client.id : ownerId,
                body:               msg.body,
                read_by_team_at:    isUnread ? null : (isClient ? sentAt : null),
                read_by_client_at:  isClient ? null : sentAt,
                created_at:         sentAt,
            });
        }
    }

    if (threadRows.length > 0) {
        const r1 = await prisma.threads.createMany({ data: threadRows, skipDuplicates: true });
        console.log(`  threads:             +${r1.count}`);
        const r2 = await prisma.messages.createMany({ data: messageRows });
        console.log(`  messages:            +${r2.count}`);
    } else {
        console.log('  threads:             0 (all clients already have threads)');
    }

    // ── Forms + form requests ─────────────────────────────────────────────────

    // Ensure at least one form exists
    let forms = await prisma.forms.findMany({
        where:  { workspace_id: wsId },
        select: { id: true, post_action: true, form_type: true, form_questions: { select: { id: true, type: true, min_value: true, max_value: true, options: true, label_en: true } } },
    });

    if (forms.length === 0) {
        console.log('\n  No forms found — creating 2 stub forms...');
        for (const tmpl of FORM_TEMPLATES) {
            const formId = createId();
            await prisma.forms.create({
                data: {
                    id:          formId,
                    workspace_id:wsId,
                    title_en:    tmpl.title,
                    status:      'published',
                    form_type:   tmpl.type,
                    post_action: tmpl.post_action,
                    form_questions: {
                        createMany: {
                            data: tmpl.questions.map((q, i) => ({
                                id:          createId(),
                                label_en:    q.label_en,
                                type:        q.type,
                                order_index: i,
                                min_value:   q.min ?? null,
                                max_value:   q.max ?? null,
                                options:     q.options ? q.options as unknown as Prisma.InputJsonValue : Prisma.DbNull,
                            })),
                        },
                    },
                },
            });
        }
        forms = await prisma.forms.findMany({
            where:  { workspace_id: wsId },
            select: { id: true, post_action: true, form_type: true, form_questions: { select: { id: true, type: true, min_value: true, max_value: true, options: true, label_en: true } } },
        });
        console.log(`  Created ${forms.length} forms with questions.`);
    }

    // Skip clients that already have form requests
    const existingReqs = await prisma.form_requests.findMany({
        where:  { workspace_id: wsId },
        select: { client_id: true },
    });
    const hasRequest = new Set(existingReqs.map(r => r.client_id));
    const clientsNeedingForms = clients.filter(c => !hasRequest.has(c.id));
    console.log(`\n  ${clientsNeedingForms.length} clients need form submissions (${hasRequest.size} already have some).`);

    const STATUS_WEIGHTS = [
        { status: 'submitted', weight: 40 },
        { status: 'reviewed',  weight: 25 },
        { status: 'pending',   weight: 22 },
        { status: 'scheduled', weight: 13 },
    ];

    function pickStatus(): string {
        const total = STATUS_WEIGHTS.reduce((s, w) => s + w.weight, 0);
        let roll = Math.random() * total;
        for (const w of STATUS_WEIGHTS) { roll -= w.weight; if (roll <= 0) return w.status; }
        return 'pending';
    }

    const reqRows:  Prisma.form_requestsCreateManyInput[]  = [];
    const respRows: Prisma.form_responsesCreateManyInput[] = [];

    for (const client of clientsNeedingForms) {
        const reqCount = randInt(1, 3);
        for (let i = 0; i < reqCount; i++) {
            const form       = pick(forms);
            const status     = pickStatus();
            const requestId  = createId();
            const requestedAt = new Date(Date.now() - randInt(1, 60) * DAY - randInt(0, DAY));

            let submittedAt: Date | null   = null;
            let scheduledAt: Date | null   = null;
            let actionTakenAt: Date | null = null;

            if (status === 'scheduled') {
                scheduledAt = new Date(Date.now() + randInt(1, 21) * DAY);
            }
            if (status === 'submitted' || status === 'reviewed') {
                submittedAt = new Date(requestedAt.getTime() + randInt(1, 5) * DAY);
            }
            if (status === 'reviewed') {
                actionTakenAt = new Date(submittedAt!.getTime() + randInt(1, 3) * DAY);
            }

            reqRows.push({
                id:             requestId,
                form_id:        form.id,
                client_id:      client.id,
                workspace_id:   wsId,
                status,
                requested_at:   requestedAt,
                submitted_at:   submittedAt,
                scheduled_at:   scheduledAt,
                action_taken_at:actionTakenAt,
                post_action:    form.post_action,
            });

            if (status === 'submitted' || status === 'reviewed') {
                for (const q of form.form_questions) {
                    respRows.push({
                        id:          createId(),
                        request_id:  requestId,
                        question_id: q.id,
                        answer:      answerFor(q),
                        created_at:  submittedAt!,
                    });
                }
            }
        }
    }

    if (reqRows.length > 0) {
        const r3 = await prisma.form_requests.createMany({ data: reqRows, skipDuplicates: true });
        console.log(`  form requests:       +${r3.count}`);
        if (respRows.length > 0) {
            const r4 = await prisma.form_responses.createMany({ data: respRows, skipDuplicates: true });
            console.log(`  form responses:      +${r4.count}`);
        }
    } else {
        console.log('  form requests:       0 (all clients already have submissions)');
    }

    console.log(`\nDone.`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
