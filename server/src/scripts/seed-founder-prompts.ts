/**
 * Seed the highest-priority Founder Prompts — the initial research push for
 * collecting ratings and open feedback that guide the roadmap.
 *
 * Idempotent: matched by question_en, only inserted when missing, so it is
 * safe to re-run (and safe to append more entries to PROMPTS over time).
 * Every prompt below is either manual/immediate (one, coach-only) or
 * contextual on its own distinct trigger_event — per insights.service.ts's
 * exclusivity rule (a manual prompt only ends another active manual prompt
 * with an overlapping audience; a contextual prompt only competes on the
 * exact same trigger) none of them end each other, so all of them stay
 * active simultaneously without needing allow_concurrent.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-founder-prompts.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const CREATED_BY = 'seed-script';

interface PromptSeed {
    questionEn: string;
    questionAr: string;
    responseType: 'rating' | 'multiple_choice' | 'text' | 'rating_with_text';
    targetAudience: 'user' | 'client' | 'everyone';
    triggerEvent: string | null;
    options?: string[];
    /** Re-ask cadence in days (e.g. 14 for bi-weekly) instead of the default ask-once-ever behavior. */
    repeatIntervalDays?: number;
    /** Opts out of the "one manual prompt at a time" exclusivity — for a recurring pulse meant to run alongside the coach NPS above. */
    allowConcurrent?: boolean;
}

const PROMPTS: PromptSeed[] = [
    {
        // Manual/immediate — no trigger_event, so it's shown as soon as it's eligible.
        questionEn: 'How likely are you to recommend FitForce to another coach? (0 = not at all, 10 = extremely likely)',
        questionAr: 'ما مدى احتمال أن توصي مدربًا آخر باستخدام FitForce؟ (0 = مستبعد تمامًا، 10 = شبه مؤكد)',
        responseType: 'rating',
        targetAudience: 'user',
        triggerEvent: null,
    },
    {
        questionEn: 'What was confusing or slow when you added your first client?',
        questionAr: 'ما الذي كان مربكًا أو بطيئًا عند إضافة أول عميل لك؟',
        responseType: 'text',
        targetAudience: 'user',
        triggerEvent: 'first_client_added',
    },
    {
        questionEn: 'What took the most extra time building that training plan?',
        questionAr: 'ما الذي استغرق أكبر وقت إضافي أثناء إنشاء تلك الخطة التدريبية؟',
        responseType: 'multiple_choice',
        targetAudience: 'user',
        triggerEvent: 'first_training_plan_activated',
        options: ['Picking exercises', 'Setting sets/reps/weights', 'Organizing days/weeks', 'It was smooth — no issues'],
    },
    {
        questionEn: 'How easy was it to complete that check-in? (0 = very hard, 10 = very easy)',
        questionAr: 'ما مدى سهولة إكمال هذا التشيك إن؟ (0 = صعب جدًا، 10 = سهل جدًا)',
        responseType: 'rating',
        targetAudience: 'client',
        triggerEvent: 'first_checkin_completed',
    },
    {
        questionEn: "You've logged 10 workouts! What would help you most going forward?",
        questionAr: 'لقد سجّلت 10 تمارين! ما الذي سيساعدك أكثر في المرحلة القادمة؟',
        responseType: 'multiple_choice',
        targetAudience: 'client',
        triggerEvent: 'workout_logs_10x',
        options: ['Progress charts / seeing my improvement', 'Reminders to stay consistent', 'Video demos for exercises', 'Something else'],
    },
    {
        questionEn: 'What took the most extra time building that nutrition plan?',
        questionAr: 'ما الذي استغرق أكبر وقت إضافي أثناء إنشاء تلك الخطة الغذائية؟',
        responseType: 'multiple_choice',
        targetAudience: 'user',
        triggerEvent: 'first_nutrition_plan_activated',
        options: ['Finding the right food items', 'Setting macros/calorie targets', 'Structuring meals/days', 'It was smooth — no issues'],
    },
    {
        questionEn: 'Anything slow or confusing about sending that message?',
        questionAr: 'هل كان هناك أي شيء بطيء أو مربك في إرسال تلك الرسالة؟',
        responseType: 'text',
        targetAudience: 'client',
        triggerEvent: 'first_message_sent_by_client',
    },
    {
        // Manual/immediate, both audiences, re-asked every 14 days — allowConcurrent so it
        // doesn't end the coach NPS prompt above (both are manual with overlapping audience).
        questionEn: "How's your overall experience with FitForce been lately?",
        questionAr: 'كيف كانت تجربتك بشكل عام مع FitForce مؤخرًا؟',
        responseType: 'rating_with_text',
        targetAudience: 'everyone',
        triggerEvent: null,
        repeatIntervalDays: 14,
        allowConcurrent: true,
    },
];

async function main() {
    console.log('Seeding Founder Prompts...');

    const existing = new Set(
        (await prisma.insight_prompts.findMany({ select: { question_en: true } })).map((p) => p.question_en),
    );

    let inserted = 0;
    for (const p of PROMPTS) {
        if (existing.has(p.questionEn)) {
            console.log(`  Skipped (already exists): "${p.questionEn.slice(0, 60)}..."`);
            continue;
        }
        await prisma.insight_prompts.create({
            data: {
                id: createId(),
                question_en: p.questionEn,
                question_ar: p.questionAr,
                response_type: p.responseType,
                options: p.options ? (p.options as Prisma.InputJsonValue) : undefined,
                target_audience: p.targetAudience,
                trigger_event: p.triggerEvent,
                status: 'active',
                created_by: CREATED_BY,
                repeat_interval_days: p.repeatIntervalDays ?? null,
                allow_concurrent: p.allowConcurrent ?? false,
            },
        });
        inserted += 1;
        console.log(`  Created: "${p.questionEn.slice(0, 60)}..."`);
    }

    console.log(`Done. +${inserted} (${PROMPTS.length - inserted} already present)`);
}

main()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
