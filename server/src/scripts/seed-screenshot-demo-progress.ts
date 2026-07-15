/**
 * Seed weight/measurement metrics + progress photos for the screenshot-demo
 * workspace's demo client, so the mobile Home (progress dashboard) has real
 * data to screenshot for the Play Store listing.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-screenshot-demo-progress.ts <clientEmail>
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const SLUG = 'screenshot-demo';
const CLIENT_EMAIL = process.argv[2];

// Served by the same static server hosting the Flutter web build (mobile/build/web/demo-photos/),
// so Image.network loads same-origin — R2's public dev URL has no CORS header and
// XHR-based image loads on Flutter web fail cross-origin without it.
const PHOTO_BASE_URL = 'http://localhost:8090/demo-photos';

async function upsertMetric(workspaceId: string, name: string, type: 'number' | 'image', unit?: string) {
    const existing = await prisma.metrics.findUnique({ where: { workspace_id_name: { workspace_id: workspaceId, name } } });
    if (existing) return existing;
    return prisma.metrics.create({
        data: { id: createId(), workspace_id: workspaceId, name, type, unit: unit ?? null },
    });
}

async function main() {
    if (!CLIENT_EMAIL) throw new Error('Usage: seed-screenshot-demo-progress.ts <clientEmail>');

    const workspace = await prisma.workspaces.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);

    const client = await prisma.clients.findFirst({
        where: { workspace_id: workspace.id, email: CLIENT_EMAIL },
        select: { id: true },
    });
    if (!client) throw new Error(`Client "${CLIENT_EMAIL}" not found in ${SLUG}`);

    // ── Metrics ────────────────────────────────────────────────────────────
    const weightMetric = await upsertMetric(workspace.id, 'Weight', 'number', 'kg');
    const waistMetric = await upsertMetric(workspace.id, 'Waist', 'number', 'cm');
    const bodyFatMetric = await upsertMetric(workspace.id, 'Body Fat', 'number', '%');
    const photoMetric = await upsertMetric(workspace.id, 'Progress Photos', 'image');

    // ── Form + version + questions (idempotent by title) ────────────────────
    let form = await prisma.forms.findFirst({ where: { workspace_id: workspace.id, title_en: 'Weekly Check-in' } });
    let version;
    if (!form) {
        const formId = createId();
        version = { id: createId() };
        form = await prisma.forms.create({
            data: {
                id: formId, workspace_id: workspace.id,
                title_en: 'Weekly Check-in', title_ar: 'المتابعة الأسبوعية',
                status: 'active', form_type: 'check-in',
                form_versions: {
                    create: { id: version.id, version_number: 1, sealed_at: new Date() },
                },
            },
        });
        await prisma.forms.update({ where: { id: form.id }, data: { current_version_id: version.id } });
    } else {
        version = await prisma.form_versions.findFirstOrThrow({ where: { form_id: form.id }, orderBy: { version_number: 'desc' } });
    }

    async function upsertQuestion(label: string, labelAr: string, metricId: string) {
        const existing = await prisma.form_version_questions.findFirst({
            where: { form_version_id: version.id, metric_id: metricId },
        });
        if (existing) return existing;
        const id = createId();
        return prisma.form_version_questions.create({
            data: {
                id, form_version_id: version.id, label_en: label, label_ar: labelAr,
                type: 'metric', metric_id: metricId, origin_question_id: id,
            },
        });
    }

    const weightQ = await upsertQuestion('Weight', 'الوزن', weightMetric.id);
    const waistQ = await upsertQuestion('Waist', 'الخصر', waistMetric.id);
    const bodyFatQ = await upsertQuestion('Body Fat', 'نسبة الدهون', bodyFatMetric.id);
    const photoQ = await upsertQuestion('Progress Photo', 'صورة التقدم', photoMetric.id);

    // ── Clear any previously seeded check-ins for this client so re-runs
    // don't stack duplicate history on top of the old straight-line data.
    const priorRequests = await prisma.form_requests.findMany({
        where: { client_id: client.id, workspace_id: workspace.id, form_id: form.id },
        select: { id: true },
    });
    await prisma.form_requests.deleteMany({ where: { id: { in: priorRequests.map(r => r.id) } } });

    const photoUrls = [1, 2, 3].map(i => `${PHOTO_BASE_URL}/progress_${i}.jpg`);

    // ── Submissions: 8 weekly check-ins with realistic fluctuation (not a
    // straight line — a real client's weight/waist/body-fat wobbles week to
    // week even on a net downward trend) ───────────────────────────────────
    // Photos sit on indices 2/5/7, not 0/4/7 — the default 90d range filter
    // (matches the app's Home range picker) drops the oldest 2 of these 8
    // readings, and a photo outside the visible range wouldn't render.
    const readings = [
        { weight: 92.4, waist: 98.0, bodyFat: 24.5 },
        { weight: 91.6, waist: 97.5, bodyFat: 24.1 },
        { weight: 92.1, waist: 98.0, bodyFat: 24.6, photo: photoUrls[0] },
        { weight: 90.2, waist: 95.5, bodyFat: 23.0 },
        { weight: 90.9, waist: 96.0, bodyFat: 23.4 },
        { weight: 88.7, waist: 93.5, bodyFat: 21.9, photo: photoUrls[1] },
        { weight: 89.3, waist: 94.0, bodyFat: 22.3 },
        { weight: 87.1, waist: 91.0, bodyFat: 20.4, photo: photoUrls[2] },
    ];

    const weeksAgoStart = readings.length * 2 - 1; // ~2 weeks apart, oldest first
    for (let i = 0; i < readings.length; i++) {
        const r = readings[i];
        const submittedAt = new Date(Date.now() - (weeksAgoStart - i * 2) * 7 * 86_400_000);
        const requestId = createId();

        const responses: Prisma.form_responsesCreateManyFormRequestsInput[] = [
            { id: createId(), question_id: weightQ.id, metric_id: weightMetric.id, answer: String(r.weight), created_at: submittedAt },
            { id: createId(), question_id: waistQ.id, metric_id: waistMetric.id, answer: String(r.waist), created_at: submittedAt },
            { id: createId(), question_id: bodyFatQ.id, metric_id: bodyFatMetric.id, answer: String(r.bodyFat), created_at: submittedAt },
        ];
        if (r.photo) {
            responses.push({ id: createId(), question_id: photoQ.id, metric_id: photoMetric.id, answer: r.photo, created_at: submittedAt });
        }

        await prisma.form_requests.create({
            data: {
                id: requestId, form_id: form.id, form_version_id: version.id,
                client_id: client.id, workspace_id: workspace.id,
                status: 'submitted', requested_at: submittedAt, submitted_at: submittedAt,
                form_responses: { createMany: { data: responses } },
            },
        });
    }

    // ── client_measurements snapshot (latest reading) ───────────────────────
    const latest = readings[readings.length - 1];
    await prisma.client_measurements.upsert({
        where: { client_id: client.id },
        create: {
            id: createId(), client_id: client.id, gender: 'male', activity_level: 'moderate',
            weight: latest.weight, height: 178, waist: latest.waist, neck: 38, hip: 96,
        },
        update: { weight: latest.weight, waist: latest.waist },
    });

    console.log(`Seeded progress data for ${CLIENT_EMAIL}: ${readings.length} check-ins, ${photoUrls.length} photos.`);
    console.log('Photo URLs:', photoUrls);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
