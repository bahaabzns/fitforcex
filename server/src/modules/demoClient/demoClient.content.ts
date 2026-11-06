// Everything the Demo Client shows lives in this file, so the wording, foods, exercises and numbers
// can be edited without touching the seeding logic (demoClient.service.ts).
//
// Rules for editing:
//  - Foods and exercises are looked up by their English name in the coach's own libraries. A name that
//    doesn't exist there is skipped, so a typo just drops that item instead of breaking signup.
//  - Every name/title carries the "Demo" label so it is obvious in lists. Keep it.
//  - Amounts for foods are in the food's serving unit (grams for most of the default list).

export const DEMO_LABEL = 'Demo';

export const DEMO_CLIENT = {
    fname: 'Demo',
    lname: 'Client',
    // The coach uses these to sign in to the client portal and see what a real client sees.
    // Public by design: the demo holds sample data only.
    email: 'demo@fitforce.demo',
    password: 'Demo1234',
    gender: 'male',
    activityLevel: 'moderate',
    heightCm: 178,
    ageYears: 30,
    neckCm: 38,
    startWeightKg: 90,
    startWaistCm: 100.3,
    startHipCm: 104,
    startBodyFatPercent: 27,
};

// ── Diet (an example, not a treatment plan) ────────────────────────────────
export const DEMO_DIET = {
    planName: 'Demo — Example meal plan (not a treatment plan)',
    disclaimer: 'Demo example only — not a treatment plan. / مثال تجريبي فقط — وليست خطة علاجية.',
    cycleDays: 14,
    reviewOffsetDays: 3,
    days: [
        {
            name: 'Demo — Example day 1',
            goalCalories: 2200, goalProtein: 170, goalCarbs: 220, goalFats: 70,
            meals: [
                { name: 'الفطار / Breakfast', items: [['Egg', 150], ['Whole Wheat Bread', 80], ['Cucumber', 100]] },
                { name: 'الغدا / Lunch', items: [['Chicken Breast', 200], ['White Rice (cooked)', 250], ['Broccoli', 100]] },
                { name: 'سناك / Snack', items: [['Greek Yogurt', 200], ['Banana', 120], ['Almonds', 20]] },
                { name: 'العشا / Dinner', items: [['Salmon', 150], ['Sweet Potato', 200], ['Spinach', 100]] },
            ],
        },
        {
            name: 'Demo — Example day 2',
            goalCalories: 2000, goalProtein: 165, goalCarbs: 180, goalFats: 65,
            meals: [
                { name: 'الفطار / Breakfast', items: [['Oats', 60], ['Milk (whole)', 250], ['Strawberry', 100]] },
                { name: 'الغدا / Lunch', items: [['Beef (lean)', 150], ['Brown Rice (cooked)', 200], ['Tomato', 100]] },
                { name: 'سناك / Snack', items: [['Cottage Cheese', 150], ['Apple', 150]] },
                { name: 'العشا / Dinner', items: [['Tuna (canned)', 120], ['Potato', 200], ['Carrot', 100]] },
            ],
        },
    ],
};

// ── Weekly training plan ───────────────────────────────────────────────────
export const DEMO_TRAINING = {
    planName: 'Demo — Example weekly training plan',
    notes: 'Demo example only. / مثال تجريبي فقط.',
    cycleDays: 28,
    reviewOffsetDays: 3,
    days: [
        { name: 'Day 1 — Push', exercises: [['Barbell Bench Press', 4, '6-8'], ['Incline Dumbbell Press', 3, '8-10'], ['Overhead Press', 3, '8-10'], ['Triceps Pushdown', 3, '10-12']] },
        { name: 'Day 2 — Pull', exercises: [['Lat Pulldown', 4, '8-10'], ['Seated Cable Row', 3, '8-10'], ['Face Pull', 3, '12-15'], ['Barbell Curl', 3, '10-12']] },
        { name: 'Day 3 — Legs', exercises: [['Back Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '10-12'], ['Standing Calf Raise', 3, '12-15']] },
    ] as Array<{ name: string; exercises: Array<[string, number, string]> }>,
    restSeconds: 90,
};

// ── Progress: weekly check-ins showing improvement ─────────────────────────
// One entry per weekly check-in, oldest first. weeksAgo counts back from today.
export const DEMO_PROGRESS = {
    checkIns: [
        { weeksAgo: 10, weightKg: 90.0, waistCm: 100.3, bodyFatPercent: 27.0, energy: 5, note: 'First week. Feeling motivated. / أول أسبوع، متحمس.' },
        { weeksAgo: 9, weightKg: 89.2, waistCm: 99.2, bodyFatPercent: 26.6, energy: 5, note: 'Hunger was high on day 2 and 3. / الجوع كان عالي في اليوم الثاني والثالث.' },
        { weeksAgo: 8, weightKg: 88.3, waistCm: 98.1, bodyFatPercent: 26.1, energy: 6, note: 'Missed one workout, travelled. / فاتني تمرين بسبب السفر.' },
        { weeksAgo: 7, weightKg: 87.6, waistCm: 97.0, bodyFatPercent: 25.7, energy: 6, note: 'Back on track with meals. / رجعت للالتزام بالوجبات.' },
        { weeksAgo: 6, weightKg: 86.4, waistCm: 95.9, bodyFatPercent: 25.1, energy: 6, note: 'Sleeping better. / النوم أحسن.' },
        { weeksAgo: 5, weightKg: 85.9, waistCm: 95.2, bodyFatPercent: 24.8, energy: 7, note: 'Weight stayed almost the same this week. / الوزن ثابت تقريباً الأسبوع ده.' },
        { weeksAgo: 4, weightKg: 84.8, waistCm: 93.9, bodyFatPercent: 24.1, energy: 7, note: 'Strength is going up. / القوة بتزيد.' },
        { weeksAgo: 3, weightKg: 83.9, waistCm: 92.9, bodyFatPercent: 23.6, energy: 8, note: 'Clothes fit looser. / الهدوم بقت أوسع.' },
        { weeksAgo: 2, weightKg: 83.4, waistCm: 92.0, bodyFatPercent: 23.1, energy: 8, note: 'Felt great in every session. / حاسس بتحسن في كل حصة.' },
        { weeksAgo: 1, weightKg: 82.9, waistCm: 91.2, bodyFatPercent: 22.5, energy: 8, note: 'Best week so far. / أحسن أسبوع لحد دلوقتي.' },
    ],
    // Latest values also fill the client's measurements card.
    hipCm: 100,
};

export const DEMO_FORMS = {
    assessment: {
        titleEn: 'Demo — Intake Assessment',
        titleAr: 'تجريبي — استمارة التقييم',
        answers: {
            goal: 'Lose fat and build strength. / تقليل الدهون وزيادة القوة.',
            experience: 'Intermediate',
            daysPerWeek: '3',
            injuries: 'Mild lower-back stiffness after long sitting. / شد خفيف في أسفل الظهر بعد الجلوس الطويل.',
        },
    },
    checkIn: {
        titleEn: 'Demo — Weekly Check-In',
        titleAr: 'تجريبي — المتابعة الأسبوعية',
    },
};

// ── Packages, payment methods, transactions ────────────────────────────────
export const DEMO_PACKAGE = {
    name: 'Demo — Online Coaching',
    currency: 'EGP',
    cycleDays: 14,
    variations: [
        { name: '1 Month', description: 'Demo package. / باقة تجريبية.', duration: 30, price: 1500 },
        { name: '3 Months', description: 'Demo package. / باقة تجريبية.', duration: 90, price: 3900 },
    ],
    // Index into variations: the one the demo client is subscribed to.
    subscribedVariationIndex: 1,
};

export const DEMO_PAYMENT_METHODS = [
    { name: 'Demo — Cash', type: 'cash' },
    { name: 'Demo — InstaPay', type: 'wallet' },
];

export const DEMO_TRANSACTIONS = [
    // daysAgo is counted back from today. Sorted oldest first.
    { daysAgo: 42, paymentMethodIndex: 1, note: 'Demo payment. / دفعة تجريبية.' },
];

// ── Messenger ──────────────────────────────────────────────────────────────
// `from` is who sent it; minutesAgo is counted back from now.
export const DEMO_MESSAGES: Array<{ from: 'team' | 'client'; body: string; minutesAgo: number }> = [
    { from: 'team', body: 'Welcome! This is a demo chat so you can see how messaging works. / أهلاً بيك! دي محادثة تجريبية عشان تشوف شكل الرسائل.', minutesAgo: 60 * 24 * 6 },
    { from: 'client', body: 'Hi coach, I finished today\'s workout. / أهلاً كابتن، خلصت تمرين النهارده.', minutesAgo: 60 * 24 * 5 },
    { from: 'team', body: 'Great job! Keep your protein high today. / برافو! حافظ على البروتين عالي النهارده.', minutesAgo: 60 * 24 * 5 - 30 },
    { from: 'client', body: 'Can I swap the rice for sweet potato at lunch? / ينفع أبدل الأرز ببطاطا في الغدا؟', minutesAgo: 60 * 24 * 2 },
    { from: 'team', body: 'Yes, same amount. You can swap it from the app. / أيوه بنفس الكمية، وتقدر تبدلها من التطبيق.', minutesAgo: 60 * 24 * 2 - 20 },
];

// ── Coach observations (category must be one of the app's observation categories) ──
export const DEMO_OBSERVATIONS: Array<{ title: string; category: string; severity: string | null; content: string; daysAgo: number }> = [
    {
        title: 'Demo — Medical history / التاريخ الطبي',
        category: 'Injury/Pain',
        severity: 'Low',
        content: 'Demo example. No chronic conditions, no allergies, no regular medication. Mild lower-back stiffness after long sitting: avoid heavy deadlifts for now and keep core work in.\n\nمثال تجريبي. لا أمراض مزمنة، لا حساسية، لا أدوية منتظمة. شد خفيف في أسفل الظهر بعد الجلوس الطويل: نتجنب الديدليفت الثقيل حالياً مع الحفاظ على تمارين الكور.',
        daysAgo: 42,
    },
    {
        title: 'Demo — Great adherence this month',
        category: 'Adherence',
        severity: null,
        content: 'Demo example. Followed the meal plan about 90% of days. / مثال تجريبي. التزم بالخطة الغذائية تقريباً 90% من الأيام.',
        daysAgo: 14,
    },
    {
        title: 'Demo — Evening snacking',
        category: 'Nutrition',
        severity: 'Medium',
        content: 'Demo example. Tends to snack after 9pm. Moved the yogurt snack later in the day. / مثال تجريبي. بياكل سناكس بعد الساعة 9. نقلنا الزبادي لوقت متأخر.',
        daysAgo: 21,
    },
    {
        title: 'Demo — Motivation is high',
        category: 'Mindset',
        severity: null,
        content: 'Demo example. Client is excited about the visible waist change. / مثال تجريبي. العميل متحمس بسبب التغيير الواضح في الوسط.',
        daysAgo: 7,
    },
];

// ── Library items the diet and training plans use ──────────────────────────
// Added to the coach's own library only when missing (matched by English name), so the demo plans are never
// empty even if the default libraries haven't been copied yet. Foods are per 100 g: [name_en, name_ar, category, kcal, protein, carbs, fats].
export const DEMO_FOODS: Array<[string, string, string, number, number, number, number]> = [
    ['Egg', 'بيض', 'Protein', 155, 13, 1.1, 11],
    ['Whole Wheat Bread', 'عيش أسمر', 'Grains', 247, 13, 41, 3.4],
    ['Cucumber', 'خيار', 'Vegetables', 15, 0.7, 3.6, 0.1],
    ['Chicken Breast', 'صدر فراخ', 'Protein', 165, 31, 0, 3.6],
    ['White Rice (cooked)', 'أرز أبيض مطبوخ', 'Carbohydrates', 130, 2.7, 28, 0.3],
    ['Broccoli', 'بروكلي', 'Vegetables', 34, 2.8, 7, 0.4],
    ['Greek Yogurt', 'زبادي يوناني', 'Dairy', 59, 10, 3.6, 0.4],
    ['Banana', 'موز', 'Fruits', 89, 1.1, 23, 0.3],
    ['Almonds', 'لوز', 'Nuts & Seeds', 579, 21, 22, 50],
    ['Salmon', 'سلمون', 'Protein', 208, 20, 0, 13],
    ['Sweet Potato', 'بطاطا', 'Carbohydrates', 86, 1.6, 20, 0.1],
    ['Spinach', 'سبانخ', 'Vegetables', 23, 2.9, 3.6, 0.4],
    ['Oats', 'شوفان', 'Grains', 389, 17, 66, 7],
    ['Milk (whole)', 'لبن كامل الدسم', 'Dairy', 61, 3.2, 4.8, 3.3],
    ['Strawberry', 'فراولة', 'Fruits', 32, 0.7, 7.7, 0.3],
    ['Beef (lean)', 'لحم بقري قليل الدهن', 'Protein', 250, 26, 0, 15],
    ['Brown Rice (cooked)', 'أرز بني مطبوخ', 'Carbohydrates', 123, 2.7, 26, 1],
    ['Tomato', 'طماطم', 'Vegetables', 18, 0.9, 3.9, 0.2],
    ['Cottage Cheese', 'جبنة قريش', 'Dairy', 98, 11, 3.4, 4.3],
    ['Apple', 'تفاح', 'Fruits', 52, 0.3, 14, 0.2],
    ['Tuna (canned)', 'تونة', 'Protein', 132, 28, 0, 1],
    ['Potato', 'بطاطس', 'Carbohydrates', 77, 2, 17, 0.1],
    ['Carrot', 'جزر', 'Vegetables', 41, 0.9, 10, 0.2],
];

// [name_en, name_ar, muscle_group, equipment]
export const DEMO_EXERCISES: Array<[string, string, string, string]> = [
    ['Barbell Bench Press', 'بنش بريس بالبار', 'Chest', 'Barbell'],
    ['Incline Dumbbell Press', 'بنش عالي دامبل', 'Chest', 'Dumbbell'],
    ['Overhead Press', 'ضغط كتف', 'Shoulders', 'Barbell'],
    ['Triceps Pushdown', 'دفع تراي', 'Triceps', 'Cable Machine'],
    ['Lat Pulldown', 'سحب أمامي', 'Back', 'Cable Machine'],
    ['Seated Cable Row', 'تجديف كابل', 'Back', 'Cable Machine'],
    ['Face Pull', 'سحب للوجه', 'Shoulders', 'Cable Machine'],
    ['Barbell Curl', 'مرجحة بار', 'Biceps', 'Barbell'],
    ['Back Squat', 'سكوات خلفي', 'Quadriceps', 'Barbell'],
    ['Romanian Deadlift', 'رومانيان ديدليفت', 'Hamstrings', 'Barbell'],
    ['Leg Press', 'ضغط أرجل', 'Quadriceps', 'Machine'],
    ['Standing Calf Raise', 'رفع سمانة واقف', 'Calves', 'Machine'],
];
