/**
 * Seed workspace muscle groups, equipment, and exercise library.
 * Idempotent — re-running will not create duplicates.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx ts-node -r tsconfig-paths/register src/scripts/seed-exercises.ts [workspaceSlug]
 *
 * workspaceSlug defaults to "test1".
 */

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const WORKSPACE_SLUG = process.argv[2] ?? 'test1';

// ── Reference data ────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
    { name_en: 'Chest',  name_ar: 'الصدر' },
    { name_en: 'Back',   name_ar: 'الظهر' },
    { name_en: 'Legs',   name_ar: 'الأرجل' },
];

const EQUIPMENTS = [
    { name_en: 'Barbell',   name_ar: 'بار' },
    { name_en: 'Dumbbell',  name_ar: 'دمبل' },
    { name_en: 'Cable',     name_ar: 'كابل' },
];

// ── Exercise library ──────────────────────────────────────────────────────────
// thumbnail_path uses YouTube's public thumbnail URL (no API key needed).
// youtube_url points to the official demonstration video.

const EXERCISES: {
    name_en: string; name_ar: string;
    muscle_group: string; equipment: string;
    youtube_url: string; thumbnail_path: string;
    instructions_en: string; instructions_ar: string;
}[] = [
    // ── Chest × Barbell (4) ──────────────────────────────────────────────────
    {
        name_en: 'Barbell Bench Press',
        name_ar: 'ضغط بنش بالبار',
        muscle_group: 'Chest', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=rT7DgCr-3pg',
        thumbnail_path:  'https://img.youtube.com/vi/rT7DgCr-3pg/hqdefault.jpg',
        instructions_en: 'Lie flat on the bench. Grip the bar slightly wider than shoulder width. Lower to mid-chest, then press to lockout.',
        instructions_ar: 'استلقِ على البنش. امسك البار بعرض أوسع قليلاً من الكتفين. أنزله إلى منتصف الصدر ثم ادفع لأعلى حتى يمتد الذراعان.',
    },
    {
        name_en: 'Incline Barbell Press',
        name_ar: 'ضغط بنش مائل بالبار',
        muscle_group: 'Chest', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=DbFgADa2PL8',
        thumbnail_path:  'https://img.youtube.com/vi/DbFgADa2PL8/hqdefault.jpg',
        instructions_en: 'Set bench to 30-45°. Press bar from upper chest upward and slightly back. Keep elbows at 45° from torso.',
        instructions_ar: 'اضبط البنش على زاوية 30-45°. ادفع البار من الجزء العلوي من الصدر للأعلى وللخلف قليلاً. حافظ على زاوية 45° بين المرفق والجذع.',
    },
    {
        name_en: 'Close-Grip Bench Press',
        name_ar: 'ضغط بنش بقبضة ضيقة',
        muscle_group: 'Chest', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=nEF0bv2FW94',
        thumbnail_path:  'https://img.youtube.com/vi/nEF0bv2FW94/hqdefault.jpg',
        instructions_en: 'Grip bar shoulder-width or slightly narrower. Lower to lower chest. Primary movers are triceps, secondary is inner chest.',
        instructions_ar: 'امسك البار بعرض الكتفين أو أضيق. أنزله نحو الجزء السفلي من الصدر. العضلة الرئيسية هي الترايسبس والصدر الداخلي كعضلة مساعدة.',
    },
    {
        name_en: 'Decline Barbell Press',
        name_ar: 'ضغط بنش منخفض بالبار',
        muscle_group: 'Chest', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=LfyQBUKR8SE',
        thumbnail_path:  'https://img.youtube.com/vi/LfyQBUKR8SE/hqdefault.jpg',
        instructions_en: 'Set bench to -15°. Lower bar to lower pec line. Good for targeting the lower chest.',
        instructions_ar: 'اضبط البنش على زاوية -15°. أنزل البار نحو خط الصدر السفلي. مثالي لاستهداف الجزء السفلي من الصدر.',
    },

    // ── Chest × Dumbbell (3) ─────────────────────────────────────────────────
    {
        name_en: 'Dumbbell Chest Fly',
        name_ar: 'تمرين الفراشة بالدمبل',
        muscle_group: 'Chest', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=eozdVDA78K0',
        thumbnail_path:  'https://img.youtube.com/vi/eozdVDA78K0/hqdefault.jpg',
        instructions_en: 'Lie flat, dumbbells above chest with slight elbow bend. Lower arms in a wide arc until chest is stretched. Squeeze back up.',
        instructions_ar: 'استلقِ على البنش مع الدمبلين فوق الصدر. أنزل الذراعين في قوس واسع حتى يمتد الصدر. ثم اجمع الذراعين للأعلى.',
    },
    {
        name_en: 'Dumbbell Bench Press',
        name_ar: 'ضغط بنش بالدمبل',
        muscle_group: 'Chest', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=VmB1G1K7v94',
        thumbnail_path:  'https://img.youtube.com/vi/VmB1G1K7v94/hqdefault.jpg',
        instructions_en: 'Press both dumbbells from chest level to full arm extension. Greater range of motion than barbell.',
        instructions_ar: 'ادفع الدمبلين من مستوى الصدر حتى امتداد الذراعين كاملاً. مدى حركة أكبر مقارنة بالبار.',
    },
    {
        name_en: 'Incline Dumbbell Fly',
        name_ar: 'تمرين الفراشة بالدمبل مائل',
        muscle_group: 'Chest', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=G_API-oO7HI',
        thumbnail_path:  'https://img.youtube.com/vi/G_API-oO7HI/hqdefault.jpg',
        instructions_en: 'Bench at 30-45°. Open arms wide until upper chest is fully stretched. Controlled return to start.',
        instructions_ar: 'البنش على 30-45°. افتح الذراعين على اتساعهما حتى يمتد الصدر العلوي بشكل كامل. العودة بشكل متحكم.',
    },

    // ── Back × Barbell (3) ───────────────────────────────────────────────────
    {
        name_en: 'Barbell Deadlift',
        name_ar: 'ديدليفت بالبار',
        muscle_group: 'Back', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=op9kVnSso6Q',
        thumbnail_path:  'https://img.youtube.com/vi/op9kVnSso6Q/hqdefault.jpg',
        instructions_en: 'Hinge at hips, grip bar outside knees. Drive through heels, keep back neutral, lock hips at top.',
        instructions_ar: 'انحنِ من الوركين، امسك البار خارج الركبتين. ادفع من الكعبين، حافظ على ظهر محايد، اقفل الوركين في الأعلى.',
    },
    {
        name_en: 'Bent-Over Barbell Row',
        name_ar: 'رو بالبار منحنياً',
        muscle_group: 'Back', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=FWJR5Ve8bnQ',
        thumbnail_path:  'https://img.youtube.com/vi/FWJR5Ve8bnQ/hqdefault.jpg',
        instructions_en: 'Hinge to ~45°, pull bar to lower chest. Lead with elbows. Squeeze shoulder blades at top.',
        instructions_ar: 'انحنِ ~45°، اسحب البار نحو الجزء السفلي من الصدر. قد بالمرفقين. اضغط على لوحي الكتف في الأعلى.',
    },
    {
        name_en: 'Barbell Shrug',
        name_ar: 'شراقس بالبار',
        muscle_group: 'Back', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=cJRVVxmytaM',
        thumbnail_path:  'https://img.youtube.com/vi/cJRVVxmytaM/hqdefault.jpg',
        instructions_en: 'Hold bar at hip height. Shrug shoulders straight up toward ears. Hold 1s, lower slowly.',
        instructions_ar: 'امسك البار عند مستوى الورك. ارفع الكتفين مستقيماً نحو الأذنين. ابقَ ثانية ثم أنزل ببطء.',
    },

    // ── Back × Dumbbell (2) ──────────────────────────────────────────────────
    {
        name_en: 'Single-Arm Dumbbell Row',
        name_ar: 'رو بدمبل واحد',
        muscle_group: 'Back', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=pYcpY20QaE8',
        thumbnail_path:  'https://img.youtube.com/vi/pYcpY20QaE8/hqdefault.jpg',
        instructions_en: 'Support body on bench with one hand and knee. Pull dumbbell to hip, elbow past torso.',
        instructions_ar: 'ادعم جسمك على البنش بيد وركبة. اسحب الدمبل نحو الورك، مرفقك يتجاوز الجذع.',
    },
    {
        name_en: 'Dumbbell Pullover',
        name_ar: 'بولوفر بالدمبل',
        muscle_group: 'Back', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=0G2_XV7slIg',
        thumbnail_path:  'https://img.youtube.com/vi/0G2_XV7slIg/hqdefault.jpg',
        instructions_en: 'Lie across bench, hold one dumbbell overhead with both hands. Arc down behind head, return to start.',
        instructions_ar: 'استلقِ عبر البنش، امسك دمبلاً واحداً فوق الرأس بكلتا يديك. أنزله خلف الرأس ثم ارجع.',
    },

    // ── Back × Cable (2) ────────────────────────────────────────────────────
    {
        name_en: 'Cable Seated Row',
        name_ar: 'رو بالكابل جالساً',
        muscle_group: 'Back', equipment: 'Cable',
        youtube_url:     'https://www.youtube.com/watch?v=GZbfZ033f74',
        thumbnail_path:  'https://img.youtube.com/vi/GZbfZ033f74/hqdefault.jpg',
        instructions_en: 'Sit upright, pull V-bar handle to abdomen. Keep chest up, squeeze back at the end of the movement.',
        instructions_ar: 'اجلس منتصباً، اسحب مقبض الـV نحو البطن. حافظ على الصدر مرفوعاً، اضغط الظهر في نهاية الحركة.',
    },
    {
        name_en: 'Cable Lat Pulldown',
        name_ar: 'بولداون بالكابل',
        muscle_group: 'Back', equipment: 'Cable',
        youtube_url:     'https://www.youtube.com/watch?v=CAwf7n6Luuc',
        thumbnail_path:  'https://img.youtube.com/vi/CAwf7n6Luuc/hqdefault.jpg',
        instructions_en: 'Wide grip on bar, lean back slightly, pull bar to upper chest. Full arm extension on the way up.',
        instructions_ar: 'قبضة عريضة على البار، انحنِ للخلف قليلاً، اسحب البار نحو الجزء العلوي من الصدر. امتداد كامل للذراعين في الأعلى.',
    },

    // ── Legs × Barbell (3) ──────────────────────────────────────────────────
    {
        name_en: 'Barbell Back Squat',
        name_ar: 'سكوات بالبار على الظهر',
        muscle_group: 'Legs', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=ultWZbUMPL8',
        thumbnail_path:  'https://img.youtube.com/vi/ultWZbUMPL8/hqdefault.jpg',
        instructions_en: 'Bar on traps, feet shoulder-width. Break at hips and knees simultaneously, squat to parallel or below. Drive through heels.',
        instructions_ar: 'البار على عضلات الظهر، القدمان بعرض الكتفين. انكسر من الوركين والركبتين معاً حتى تصل للمحاذاة أو أسفل. ادفع من الكعبين.',
    },
    {
        name_en: 'Barbell Romanian Deadlift',
        name_ar: 'ديدليفت روماني بالبار',
        muscle_group: 'Legs', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=JCXUYuzwNrM',
        thumbnail_path:  'https://img.youtube.com/vi/JCXUYuzwNrM/hqdefault.jpg',
        instructions_en: 'Hinge at hips with soft knees, lower bar along legs until hamstrings are fully stretched. Drive hips forward to return.',
        instructions_ar: 'انحنِ من الوركين مع ركبتين مرنتين، أنزل البار على طول الساقين حتى يمتد الجزء الخلفي من الفخذ. ادفع الوركين للأمام للعودة.',
    },
    {
        name_en: 'Barbell Lunge',
        name_ar: 'لانج بالبار',
        muscle_group: 'Legs', equipment: 'Barbell',
        youtube_url:     'https://www.youtube.com/watch?v=D7KaRcUTQeE',
        thumbnail_path:  'https://img.youtube.com/vi/D7KaRcUTQeE/hqdefault.jpg',
        instructions_en: 'Bar on traps, step forward, lower back knee toward floor. Keep front shin vertical.',
        instructions_ar: 'البار على الظهر، خطو للأمام وأنزل الركبة الخلفية نحو الأرض. حافظ على استقامة الساق الأمامية.',
    },

    // ── Legs × Dumbbell (2) ──────────────────────────────────────────────────
    {
        name_en: 'Dumbbell Goblet Squat',
        name_ar: 'جوبليت سكوات بالدمبل',
        muscle_group: 'Legs', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=MeIiIdhvXT4',
        thumbnail_path:  'https://img.youtube.com/vi/MeIiIdhvXT4/hqdefault.jpg',
        instructions_en: 'Hold one dumbbell vertically at chest. Squat deep with elbows tracking inside knees.',
        instructions_ar: 'امسك دمبلاً واحداً بشكل عمودي عند الصدر. اقعِ بعمق مع المرفقين داخل الركبتين.',
    },
    {
        name_en: 'Dumbbell Walking Lunge',
        name_ar: 'لانج مشي بالدمبل',
        muscle_group: 'Legs', equipment: 'Dumbbell',
        youtube_url:     'https://www.youtube.com/watch?v=L8fvypPrzzs',
        thumbnail_path:  'https://img.youtube.com/vi/L8fvypPrzzs/hqdefault.jpg',
        instructions_en: 'Hold dumbbells at sides. Step forward into a lunge, bring back foot to meet front, repeat alternating.',
        instructions_ar: 'امسك الدمبلين على الجانبين. خطو للأمام في وضع اللانج، أحضر القدم الخلفية للأمام وكرر بشكل متبادل.',
    },

    // ── Legs × Cable (1) ────────────────────────────────────────────────────
    {
        name_en: 'Cable Leg Curl',
        name_ar: 'كيرل ساق بالكابل',
        muscle_group: 'Legs', equipment: 'Cable',
        youtube_url:     'https://www.youtube.com/watch?v=ELOCsoDSmrg',
        thumbnail_path:  'https://img.youtube.com/vi/ELOCsoDSmrg/hqdefault.jpg',
        instructions_en: 'Attach ankle cuff, stand facing machine. Curl heel toward glutes. Keep hip stable throughout.',
        instructions_ar: 'ضع الكفة على الكاحل، قف مواجهاً الجهاز. اثنِ الكعب نحو الأرداف. حافظ على استقرار الورك طوال الحركة.',
    },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const workspace = await prisma.workspaces.findFirst({ where: { slug: WORKSPACE_SLUG } });
    if (!workspace) throw new Error(`Workspace "${WORKSPACE_SLUG}" not found`);

    const workspaceId = workspace.id;
    console.log(`Seeding into workspace "${workspace.name}" (${workspaceId})\n`);

    // ── Muscle groups ──────────────────────────────────────────────────────────
    const existingMuscleGroups = await prisma.exercise_muscle_groups.findMany({
        where: { workspace_id: workspaceId },
        select: { name_en: true },
    });
    const existingMuscleGroupNames = new Set(existingMuscleGroups.map((m) => m.name_en.toLowerCase()));

    const muscleGroupsToInsert = MUSCLE_GROUPS.filter(
        (m) => !existingMuscleGroupNames.has(m.name_en.toLowerCase()),
    );
    if (muscleGroupsToInsert.length) {
        await prisma.exercise_muscle_groups.createMany({
            data: muscleGroupsToInsert.map((m) => ({
                id: createId(), workspace_id: workspaceId, name_en: m.name_en, name_ar: m.name_ar,
            })),
        });
    }
    console.log(`exercise_muscle_groups: +${muscleGroupsToInsert.length} inserted (${MUSCLE_GROUPS.length - muscleGroupsToInsert.length} already present)`);

    // ── Equipment ──────────────────────────────────────────────────────────────
    const existingEquipments = await prisma.exercise_equipments.findMany({
        where: { workspace_id: workspaceId },
        select: { name_en: true },
    });
    const existingEquipmentNames = new Set(existingEquipments.map((e) => e.name_en.toLowerCase()));

    const equipmentsToInsert = EQUIPMENTS.filter(
        (e) => !existingEquipmentNames.has(e.name_en.toLowerCase()),
    );
    if (equipmentsToInsert.length) {
        await prisma.exercise_equipments.createMany({
            data: equipmentsToInsert.map((e) => ({
                id: createId(), workspace_id: workspaceId, name_en: e.name_en, name_ar: e.name_ar,
            })),
        });
    }
    console.log(`exercise_equipments:    +${equipmentsToInsert.length} inserted (${EQUIPMENTS.length - equipmentsToInsert.length} already present)`);

    // ── Exercise library ───────────────────────────────────────────────────────
    const existingExercises = await prisma.exercise_library.findMany({
        where: { workspace_id: workspaceId },
        select: { name_en: true },
    });
    const existingExerciseNames = new Set(existingExercises.map((e) => e.name_en.toLowerCase()));

    const exercisesToInsert = EXERCISES.filter(
        (e) => !existingExerciseNames.has(e.name_en.toLowerCase()),
    );
    if (exercisesToInsert.length) {
        await prisma.exercise_library.createMany({
            data: exercisesToInsert.map((e) => ({
                id:              createId(),
                workspace_id:    workspaceId,
                name_en:         e.name_en,
                name_ar:         e.name_ar,
                muscle_group:    e.muscle_group,
                equipment:       e.equipment,
                youtube_url:     e.youtube_url,
                thumbnail_path:  e.thumbnail_path,
                instructions_en: e.instructions_en,
                instructions_ar: e.instructions_ar,
            })),
        });
    }
    console.log(`exercise_library:       +${exercisesToInsert.length} inserted (${EXERCISES.length - exercisesToInsert.length} already present)`);

    console.log('\nDone.');
}

main()
    .catch((err) => { console.error('Seed failed:', err.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
