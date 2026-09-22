/**
 * Seed / update the highest-priority Founder Prompts — the initial research push for
 * collecting ratings and open feedback that guide the roadmap.
 *
 * Idempotent, and safe to re-run after editing PROMPTS: for each entry, a row is
 * matched first by `oldQuestionEn` (if given — set this when you reword an existing
 * prompt) and otherwise by the current `questionEn`. A match gets its content
 * (question, response type, options, repeat interval, concurrency) updated in
 * place; no match gets inserted as a new prompt. `target_audience`, `trigger_event`,
 * and `status` are never touched on an update — only content, never targeting or
 * lifecycle state.
 *
 * Every prompt below is either manual/immediate (one, coach-only, plus the
 * everyone/bi-weekly pulse) or contextual on its own distinct trigger_event — per
 * insights.service.ts's exclusivity rule (a manual prompt only ends another active
 * manual prompt with an overlapping audience; a contextual prompt only competes on
 * the exact same trigger) none of them end each other.
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
    /** Set when reworded from a prior seed run, so this entry updates that row in place instead of inserting a duplicate. */
    oldQuestionEn?: string;
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
        responseType: 'rating_with_text',
        targetAudience: 'user',
        triggerEvent: null,
    },
    {
        questionEn: 'How smooth was adding your first client? (0 = very confusing, 10 = very smooth)',
        questionAr: 'ما مدى سلاسة إضافة أول عميل لك؟ (0 = مربك جدًا، 10 = سلس جدًا)',
        oldQuestionEn: 'What was confusing or slow when you added your first client?',
        responseType: 'rating_with_text',
        targetAudience: 'user',
        triggerEvent: 'first_client_added',
    },
    {
        questionEn: 'How smooth was building that training plan? (0 = very slow, 10 = very smooth)',
        questionAr: 'ما مدى سلاسة إنشاء تلك الخطة التدريبية؟ (0 = بطيء جدًا، 10 = سلس جدًا)',
        oldQuestionEn: 'What took the most extra time building that training plan?',
        responseType: 'rating_with_text',
        targetAudience: 'user',
        triggerEvent: 'first_training_plan_activated',
    },
    {
        questionEn: 'How easy was it to complete that check-in? (0 = very hard, 10 = very easy)',
        questionAr: 'ما مدى سهولة إكمال هذا التشيك إن؟ (0 = صعب جدًا، 10 = سهل جدًا)',
        responseType: 'rating_with_text',
        targetAudience: 'client',
        triggerEvent: 'first_checkin_completed',
    },
    {
        questionEn: "How's it going after logging 10 workouts? (0 = not great, 10 = amazing)",
        questionAr: 'كيف كانت تجربتك بعد تسجيل 10 تمارين؟ (0 = غير جيدة، 10 = رائعة)',
        oldQuestionEn: "You've logged 10 workouts! What would help you most going forward?",
        responseType: 'rating_with_text',
        targetAudience: 'client',
        triggerEvent: 'workout_logs_10x',
    },
    {
        questionEn: 'How smooth was building that nutrition plan? (0 = very slow, 10 = very smooth)',
        questionAr: 'ما مدى سلاسة إنشاء تلك الخطة الغذائية؟ (0 = بطيء جدًا، 10 = سلس جدًا)',
        oldQuestionEn: 'What took the most extra time building that nutrition plan?',
        responseType: 'rating_with_text',
        targetAudience: 'user',
        triggerEvent: 'first_nutrition_plan_activated',
    },
    {
        questionEn: 'How smooth was sending that message? (0 = very confusing, 10 = very smooth)',
        questionAr: 'ما مدى سلاسة إرسال تلك الرسالة؟ (0 = مربكة جدًا، 10 = سلسة جدًا)',
        oldQuestionEn: 'Anything slow or confusing about sending that message?',
        responseType: 'rating_with_text',
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
    console.log('Seeding / updating Founder Prompts...');

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const p of PROMPTS) {
        const candidates = [p.oldQuestionEn, p.questionEn].filter((q): q is string => !!q);
        const existing = await prisma.insight_prompts.findFirst({ where: { question_en: { in: candidates } } });

        const contentData = {
            question_en: p.questionEn,
            question_ar: p.questionAr,
            response_type: p.responseType,
            options: p.options ? (p.options as Prisma.InputJsonValue) : Prisma.JsonNull,
            repeat_interval_days: p.repeatIntervalDays ?? null,
            allow_concurrent: p.allowConcurrent ?? false,
        };

        if (existing) {
            const changed = existing.question_en !== p.questionEn || existing.response_type !== p.responseType;
            if (changed) {
                await prisma.insight_prompts.update({ where: { id: existing.id }, data: contentData });
                updated += 1;
                console.log(`  Updated: "${p.questionEn.slice(0, 60)}..."`);
            } else {
                unchanged += 1;
            }
            continue;
        }

        await prisma.insight_prompts.create({
            data: {
                id: createId(),
                ...contentData,
                target_audience: p.targetAudience,
                trigger_event: p.triggerEvent,
                status: 'active',
                created_by: CREATED_BY,
            },
        });
        created += 1;
        console.log(`  Created: "${p.questionEn.slice(0, 60)}..."`);
    }

    console.log(`Done. +${created} created, ${updated} updated, ${unchanged} unchanged.`);
}

main()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
