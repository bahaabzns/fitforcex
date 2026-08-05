/**
 * Seed exercise library for the bahaa-bzns workspace with YouTube video links.
 * Run with: npx tsx prisma/seedExercises.ts
 */
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const WORKSPACE_SLUG = 'bahaa-bzns';

const MUSCLE_GROUPS = [
  { name_en: 'Chest',     name_ar: 'الصدر' },
  { name_en: 'Back',      name_ar: 'الظهر' },
  { name_en: 'Shoulders', name_ar: 'الأكتاف' },
  { name_en: 'Biceps',    name_ar: 'العضلة ذات الرأسين' },
  { name_en: 'Triceps',   name_ar: 'العضلة ذات الثلاثة رؤوس' },
  { name_en: 'Legs',      name_ar: 'الأرجل' },
  { name_en: 'Glutes',    name_ar: 'الأرداف' },
  { name_en: 'Core',      name_ar: 'العضلة الجوهرية' },
  { name_en: 'Cardio',    name_ar: 'القلب والأوعية الدموية' },
];

const EQUIPMENT_LIST = [
  { name_en: 'Barbell',     name_ar: 'بار' },
  { name_en: 'Dumbbell',    name_ar: 'دمبل' },
  { name_en: 'Cable',       name_ar: 'كابل' },
  { name_en: 'Machine',     name_ar: 'جهاز' },
  { name_en: 'Bodyweight',  name_ar: 'وزن الجسم' },
  { name_en: 'Bands',       name_ar: 'أربطة مقاومة' },
  { name_en: 'Kettlebell',  name_ar: 'كيتل بيل' },
];

// exercises: name_en, name_ar, muscle_group, equipment, youtube_url, instructions_en
const EXERCISES = [
  // ── Chest ─────────────────────────────────────────────────────────────────
  {
    name_en: 'Barbell Bench Press',
    name_ar: 'تمرين الضغط بالبار على البنش',
    muscle_group: 'Chest',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
    instructions_en: 'Lie flat on a bench. Grip the bar just outside shoulder-width. Lower it to mid-chest under control, then press back to full extension without locking out. Keep feet flat, arch natural, and retract scapulae throughout.',
  },
  {
    name_en: 'Incline Dumbbell Press',
    name_ar: 'ضغط الدمبل المائل للأعلى',
    muscle_group: 'Chest',
    equipment: 'Dumbbell',
    youtube_url: 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
    instructions_en: 'Set bench to 30–45°. Press dumbbells from shoulder level up and slightly inward. Lower under control until elbows are slightly below bench level. Focus on upper-chest contraction at the top.',
  },
  {
    name_en: 'Push-Up',
    name_ar: 'تمرين الضغط (بوش أب)',
    muscle_group: 'Chest',
    equipment: 'Bodyweight',
    youtube_url: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
    instructions_en: 'Start in a high plank with hands slightly wider than shoulder-width. Lower chest to the floor, keeping elbows at ~45° to the torso. Push back to full arm extension while maintaining a rigid plank position.',
  },
  {
    name_en: 'Cable Chest Fly',
    name_ar: 'تمرين الفتحة بالكابل',
    muscle_group: 'Chest',
    equipment: 'Cable',
    youtube_url: 'https://www.youtube.com/watch?v=WEM9FCIPlxQ',
    instructions_en: 'Set pulleys at shoulder height. Stand in a split stance, grip handles, and bring hands together in a wide arc in front of your chest. Squeeze at the peak. Control the return stretch.',
  },
  // ── Back ──────────────────────────────────────────────────────────────────
  {
    name_en: 'Pull-Up',
    name_ar: 'سحبة (بول أب)',
    muscle_group: 'Back',
    equipment: 'Bodyweight',
    youtube_url: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
    instructions_en: 'Hang from a bar with an overhand grip slightly wider than shoulder-width. Pull your chest to the bar by driving elbows down and back. Lower under full control until arms are completely extended.',
  },
  {
    name_en: 'Barbell Bent-Over Row',
    name_ar: 'تمرين السحب بالبار',
    muscle_group: 'Back',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=kBWAon7ItDw',
    instructions_en: 'Hinge forward to ~45°, keep a neutral spine. Pull the bar to your lower sternum, leading with elbows. Squeeze the lats at the top, then lower under control to full arm extension.',
  },
  {
    name_en: 'Lat Pulldown',
    name_ar: 'سحب اللات بالكابل',
    muscle_group: 'Back',
    equipment: 'Cable',
    youtube_url: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
    instructions_en: 'Sit with thighs secured. Grip bar wider than shoulder-width. Pull bar to upper chest while leaning back slightly and driving elbows toward your hips. Control the ascent fully.',
  },
  {
    name_en: 'Seated Cable Row',
    name_ar: 'السحب الأفقي بالكابل جالس',
    muscle_group: 'Back',
    equipment: 'Cable',
    youtube_url: 'https://www.youtube.com/watch?v=GZbfZ033f74',
    instructions_en: 'Sit upright with legs slightly bent. Pull the handle to your lower abdomen, squeezing shoulder blades together. Keep chest up and avoid rounding the lower back. Extend arms fully between reps.',
  },
  {
    name_en: 'Deadlift',
    name_ar: 'رفعة الميت',
    muscle_group: 'Back',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
    instructions_en: 'Stand with mid-foot under the bar. Hinge at hips to grip just outside your legs. Brace core, chest up, push the floor away. Lock out hips and knees simultaneously at the top. Hinge back down under control.',
  },
  // ── Shoulders ─────────────────────────────────────────────────────────────
  {
    name_en: 'Barbell Overhead Press',
    name_ar: 'الضغط العسكري بالبار',
    muscle_group: 'Shoulders',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
    instructions_en: 'Stand with bar at upper chest. Press straight up, moving your head slightly back then forward around the bar. Lock out overhead. Lower to clavicle under control. Keep core braced and glutes engaged throughout.',
  },
  {
    name_en: 'Dumbbell Lateral Raise',
    name_ar: 'تمرين الرفع الجانبي بالدمبل',
    muscle_group: 'Shoulders',
    equipment: 'Dumbbell',
    youtube_url: 'https://www.youtube.com/watch?v=3VcKaXpzqRo',
    instructions_en: 'Hold dumbbells at your sides. Raise arms out to shoulder height with a slight forward tilt and a slight internal rotation (pinky slightly higher). Pause briefly at the top. Lower slowly in 3–4 seconds.',
  },
  {
    name_en: 'Face Pull',
    name_ar: 'سحب الوجه بالكابل',
    muscle_group: 'Shoulders',
    equipment: 'Cable',
    youtube_url: 'https://www.youtube.com/watch?v=rep-qVOkqgk',
    instructions_en: 'Set cable to upper-chest height with a rope. Pull the rope toward your face, separating hands at the end and externally rotating the shoulders. Hold the squeeze 1 second. Return under control.',
  },
  // ── Biceps ────────────────────────────────────────────────────────────────
  {
    name_en: 'Barbell Curl',
    name_ar: 'ثني الكوع بالبار',
    muscle_group: 'Biceps',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=kwG2ipFRgfo',
    instructions_en: 'Stand with bar at hip level, supinated grip. Curl the bar by flexing the elbow — do not swing the torso. Squeeze the bicep at the top. Lower slowly over 3 seconds to full extension.',
  },
  {
    name_en: 'Hammer Curl',
    name_ar: 'ثني الكوع المطرقة بالدمبل',
    muscle_group: 'Biceps',
    equipment: 'Dumbbell',
    youtube_url: 'https://www.youtube.com/watch?v=zC3nLlEvin4',
    instructions_en: 'Hold dumbbells with a neutral (hammer) grip. Curl both or alternate, keeping elbows pinned to your sides. Squeeze at the top. Lower under control. Targets the brachialis and brachioradialis in addition to the biceps.',
  },
  // ── Triceps ───────────────────────────────────────────────────────────────
  {
    name_en: 'Close-Grip Bench Press',
    name_ar: 'ضغط البنش بقبضة ضيقة للترايسبس',
    muscle_group: 'Triceps',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=nEF0bv2FW94',
    instructions_en: 'Grip the bar about shoulder-width. Lower to your lower chest, keeping elbows tucked. Press to extension — the primary mover is the tricep. Do not let your wrists bend backward.',
  },
  {
    name_en: 'Cable Tricep Pushdown',
    name_ar: 'الضغط السفلي للترايسبس بالكابل',
    muscle_group: 'Triceps',
    equipment: 'Cable',
    youtube_url: 'https://www.youtube.com/watch?v=2-LAMcpzODU',
    instructions_en: 'Stand at a high cable with a straight bar or rope. Pin elbows to sides. Push bar down to full extension and squeeze the tricep hard at the bottom. Slowly return until forearms are parallel.',
  },
  {
    name_en: 'Skull Crusher',
    name_ar: 'سحقة الجمجمة بالبار',
    muscle_group: 'Triceps',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=d_KZxkY_0cM',
    instructions_en: 'Lie on a bench. Hold an EZ-bar with a close, overhand grip directly above your forehead. Lower the bar toward your forehead by flexing the elbows only. Extend back to start. Keep upper arms vertical throughout.',
  },
  // ── Legs ──────────────────────────────────────────────────────────────────
  {
    name_en: 'Barbell Back Squat',
    name_ar: 'القرفصاء بالبار من الخلف',
    muscle_group: 'Legs',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
    instructions_en: 'Place bar on upper traps. Stand slightly wider than hip-width, toes out 30°. Break at hips and knees simultaneously. Descend until hips are at or below parallel. Drive through mid-foot to stand, keeping chest tall.',
  },
  {
    name_en: 'Romanian Deadlift',
    name_ar: 'رفعة الميت الرومانية',
    muscle_group: 'Legs',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=7j-2GmWRCdE',
    instructions_en: 'Stand holding bar at hip level. Push hips back — not down — and lower the bar along your legs until you feel a hamstring stretch (mid-shin level for most). Keep a neutral spine, then drive hips forward to return.',
  },
  {
    name_en: 'Leg Press',
    name_ar: 'تمرين ضغط الساق بالجهاز',
    muscle_group: 'Legs',
    equipment: 'Machine',
    youtube_url: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
    instructions_en: 'Sit with feet shoulder-width on the platform. Lower the sled until knees are at 90°. Push through mid-foot to full extension — stop just short of locking the knees. Keep lower back in contact with the seat.',
  },
  {
    name_en: 'Bulgarian Split Squat',
    name_ar: 'تمرين القرفصاء البلغارية',
    muscle_group: 'Legs',
    equipment: 'Dumbbell',
    youtube_url: 'https://www.youtube.com/watch?v=2C-uNgKwPLE',
    instructions_en: 'Elevate rear foot on a bench. Hold dumbbells at your sides. Lower front knee toward the floor, keeping the torso upright. Drive through the heel of the front foot to return. Challenges balance and quad/glute strength unilaterally.',
  },
  // ── Glutes ────────────────────────────────────────────────────────────────
  {
    name_en: 'Hip Thrust',
    name_ar: 'دفع الورك',
    muscle_group: 'Glutes',
    equipment: 'Barbell',
    youtube_url: 'https://www.youtube.com/watch?v=xDmFkJxPzeM',
    instructions_en: 'Sit on the floor with upper back against a bench, bar across hips. Plant feet flat, drive hips upward until torso is horizontal. Squeeze glutes hard at the top. Lower under control. Do not hyperextend the lumbar.',
  },
  // ── Core ──────────────────────────────────────────────────────────────────
  {
    name_en: 'Plank',
    name_ar: 'تمرين البلانك',
    muscle_group: 'Core',
    equipment: 'Bodyweight',
    youtube_url: 'https://www.youtube.com/watch?v=ASdvN_XEl_c',
    instructions_en: 'Forearms on the floor, elbows under shoulders. Form a straight line from head to heels — do not sag or pike. Brace as if someone will punch your stomach. Hold the position for time.',
    tracking_type: 'time_based',
    tracked_metrics: ['duration_seconds'],
  },
  {
    name_en: 'Cable Crunch',
    name_ar: 'تمرين الكرانش بالكابل',
    muscle_group: 'Core',
    equipment: 'Cable',
    youtube_url: 'https://www.youtube.com/watch?v=2fbujeH3F0E',
    instructions_en: 'Kneel at a high cable with a rope behind your head. Curl your thoracic spine downward — not just bending at the hips. Pull elbows toward knees. Squeeze abs at the bottom. Extend back up under control.',
  },
];

async function main() {
  const workspace = await prisma.workspaces.findUnique({ where: { slug: WORKSPACE_SLUG } });
  if (!workspace) {
    console.error(`Workspace "${WORKSPACE_SLUG}" not found.`);
    process.exit(1);
  }
  console.log(`Found workspace: ${workspace.name} (${workspace.id})`);

  // Upsert muscle groups
  for (const mg of MUSCLE_GROUPS) {
    const existing = await prisma.exercise_muscle_groups.findFirst({
      where: { workspace_id: workspace.id, name_en: mg.name_en },
    });
    if (!existing) {
      await prisma.exercise_muscle_groups.create({
        data: { id: createId(), workspace_id: workspace.id, ...mg },
      });
      console.log(`  + Muscle group: ${mg.name_en}`);
    }
  }

  // Upsert equipment
  for (const eq of EQUIPMENT_LIST) {
    const existing = await prisma.exercise_equipments.findFirst({
      where: { workspace_id: workspace.id, name_en: eq.name_en },
    });
    if (!existing) {
      await prisma.exercise_equipments.create({
        data: { id: createId(), workspace_id: workspace.id, ...eq },
      });
      console.log(`  + Equipment: ${eq.name_en}`);
    }
  }

  // Upsert exercises (skip if name_en already exists in this workspace)
  let created = 0;
  let skipped = 0;
  for (const ex of EXERCISES) {
    const existing = await prisma.exercise_library.findFirst({
      where: { workspace_id: workspace.id, name_en: ex.name_en },
    });
    if (existing) {
      // Backfill youtube_url/tracking_type/tracked_metrics if any is missing
      // or stale — this catches rows seeded before the tracking-type feature
      // existed (e.g. "Plank" defaulting to 'sets_reps' when it should be
      // 'time_based' + duration, see exerciseTrackingTypes.ts).
      const needsYoutubeUrl = !existing.youtube_url && ex.youtube_url;
      const needsTrackingType = ex.tracking_type && existing.tracking_type !== ex.tracking_type;
      const wantedMetrics = ex.tracked_metrics ?? [];
      const needsTrackedMetrics = ex.tracking_type
          && JSON.stringify([...existing.tracked_metrics].sort()) !== JSON.stringify([...wantedMetrics].sort());
      if (needsYoutubeUrl || needsTrackingType || needsTrackedMetrics) {
        await prisma.exercise_library.update({
          where: { id: existing.id },
          data: {
            ...(needsYoutubeUrl ? { youtube_url: ex.youtube_url } : {}),
            ...(needsTrackingType ? { tracking_type: ex.tracking_type } : {}),
            ...(needsTrackedMetrics ? { tracked_metrics: wantedMetrics } : {}),
            updated_at: new Date(),
          },
        });
        console.log(`  ~ Updated ${ex.name_en}`);
      } else {
        skipped++;
      }
    } else {
      await prisma.exercise_library.create({
        data: {
          id:              createId(),
          workspace_id:    workspace.id,
          name_en:         ex.name_en,
          name_ar:         ex.name_ar,
          muscle_group:    ex.muscle_group,
          equipment:       ex.equipment,
          youtube_url:     ex.youtube_url,
          instructions_en: ex.instructions_en,
          tracking_type:   ex.tracking_type ?? 'sets_reps',
          tracked_metrics: ex.tracked_metrics ?? [],
        },
      });
      console.log(`  + Exercise: ${ex.name_en}`);
      created++;
    }
  }

  console.log(`\nDone. Created ${created} exercises, skipped ${skipped} (already existed).`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
