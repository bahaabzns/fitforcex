// Text pools for the demo-workspace seed: names, chat lines, coach notes, form answers.
// Mixed English/Arabic because the product is used by an Egyptian/Gulf coaching market.

export const MALE_FIRST = [
    'Ahmed', 'Mohamed', 'Mahmoud', 'Omar', 'Ali', 'Hassan', 'Khaled', 'Youssef', 'Mostafa', 'Tarek', 'Karim', 'Amr',
    'Sherif', 'Hossam', 'Tamer', 'Walid', 'Sami', 'Nader', 'Fady', 'Ibrahim', 'Adel', 'Ziad', 'Hany', 'Ramy',
    'Mazen', 'Seif', 'Yassin', 'Marwan', 'Abdelrahman', 'Osama', 'Hazem', 'Moustafa', 'Anas', 'Bassem', 'Fares', 'Laith',
    'أحمد', 'محمد', 'محمود', 'عمر', 'علي', 'خالد', 'يوسف', 'مصطفى', 'كريم', 'عمرو', 'حسام', 'زياد',
];
export const FEMALE_FIRST = [
    'Sara', 'Mona', 'Nour', 'Hana', 'Laila', 'Salma', 'Mariam', 'Yasmin', 'Dina', 'Rana', 'Nada', 'Farida', 'Jana',
    'Habiba', 'Malak', 'Reem', 'Aya', 'Rawan', 'Heba', 'Shaimaa', 'Mai', 'Nermeen', 'Ghada', 'Lina', 'Judy', 'Tala',
    'Doaa', 'Eman', 'Amira', 'Passant', 'Nourhan', 'Sandy', 'Hagar', 'Menna', 'Rahma', 'Alia',
    'سارة', 'منى', 'نور', 'هنا', 'ليلى', 'سلمى', 'مريم', 'ياسمين', 'دينا', 'رنا', 'ندى', 'فريدة',
];
export const LAST_NAMES = [
    'Hassan', 'Ibrahim', 'Mahmoud', 'Said', 'Fathy', 'Mansour', 'Gamal', 'Saad', 'Adel', 'Naguib', 'Sabry', 'Lotfy',
    'Zaki', 'Shawky', 'Ramadan', 'Fawzy', 'Hamdy', 'Abdel Aziz', 'El Sayed', 'Kamal', 'Farouk', 'Nabil', 'Samir',
    'Salem', 'Younis', 'Darwish', 'Metwally', 'Abbas', 'Helmy', 'Taha', 'Ashour', 'Morsi', 'Badawy', 'Eid',
    'العطار', 'الشريف', 'منصور', 'سعد', 'فتحي', 'جمال', 'عادل', 'صبري', 'رمضان', 'حمدي', 'السيد', 'كمال',
];

export const COUNTRY_CODES = ['+20', '+20', '+20', '+20', '+966', '+971', '+965', '+974'];

// ── Chat ───────────────────────────────────────────────────────────────────
export const TEAM_OPENERS = [
    'Hey! Just checking in. How has this week been going for you?',
    "Hi! I reviewed your latest check-in and you're making great progress.",
    'Good morning! Your training plan has been updated, take a look when you get a chance.',
    'Quick reminder to log your workouts so I can track your progress properly.',
    "I've adjusted your nutrition targets for the coming week based on your last results.",
    'How are you feeling after the new training split? Let me know if anything feels off.',
    'Your meal plan is ready! Tell me if you have any questions about the portions.',
    'صباح الخير! خطتك الجديدة جاهزة، بصّ عليها وقولي رأيك.',
    'أهلاً! شفت الشيك إن بتاعك وشغلك ممتاز الأسبوع ده 👏',
];
export const CLIENT_REPLIES = [
    'Thanks coach! Feeling great, the new plan is working well.',
    'I had a rough week at work but managed to hit 4 sessions.',
    'Got it! Will check the updated plan now.',
    "Noted. I'll make sure to log everything from tomorrow.",
    'The new split feels harder but I can tell I am progressing.',
    'Can I swap the rice for oats in the pre-workout meal?',
    'This week was tough. Missed one session but kept the nutrition on track.',
    'Feeling stronger already! Weight is down 1.5 kg this month.',
    'Should I adjust my portions on rest days too?',
    "I've been struggling with sleep lately. Could that be affecting my recovery?",
    'My knee is a bit sore after squats, should I lower the weight?',
    'شكراً كابتن، حاسس بفرق كبير في الطاقة.',
    'الأسبوع ده كان صعب شوية بس ملتزم بالأكل.',
    'ممكن أبدل الفراخ بسمك في الغدا؟',
    'تمام كابتن، هبعتلك الصور بكرة إن شاء الله.',
];
export const TEAM_FOLLOWUPS = [
    "That's great to hear, keep it up!",
    "Four sessions is solid given your schedule. Don't stress about the missed one.",
    'Of course, oats are a fine swap. Same amount by weight.',
    "Sleep is definitely a factor. Aim for 7-8 hours and we'll reassess next week.",
    'Yes, lower your carbs by about 20 g on rest days.',
    "Perfect! Let's aim for the same consistency next week.",
    "That's a great result. Keep logging and we'll push for another 1 kg next month.",
    'Totally understandable. Get back on track tomorrow, no need to compensate.',
    'Drop the load by about 10% and focus on controlled reps. If it persists, tell me.',
    'تمام جداً، كمّل كده 💪',
    'أيوه ممكن تبدل، نفس الكمية بالجرام.',
    'ماشي، ابعتلي الصور وهراجعها معاك.',
];
export const CLIENT_LASTS = [
    'Will do, thanks!', 'Sounds good coach.', 'Perfect, thanks for the quick reply!', 'Got it, appreciate it!',
    "I'll give it a try.", 'Thanks, that makes sense.', 'تمام شكراً كابتن 🙏', 'حاضر كابتن',
];
export const CLIENT_UNREAD_PINGS = [
    'Coach, are you available to review my check-in today?',
    'Hi coach, I just submitted my weekly check-in, please have a look.',
    'Can we change my training days this week? I have travel plans.',
    'I finished the whole week of the plan, what is next?',
    'كابتن ممكن تراجع الشيك إن بتاعي؟',
    'عندي سؤال بخصوص الوجبة التانية في الخطة.',
];

// ── Coach notes (client observations) ──────────────────────────────────────
export interface ObservationTemplate { title: string; content: string; category: string; severity: string | null }
export const OBSERVATION_TEMPLATES: ObservationTemplate[] = [
    { title: 'Strong motivation', content: 'Highly motivated and consistent with check-ins. Responds well to progressive overload.', category: 'Mindset', severity: null },
    { title: 'Squat depth', content: 'Needs cues on depth and knee tracking during squats. Filmed a set for review.', category: 'Technique', severity: 'Medium' },
    { title: 'Knee discomfort', content: 'Reports mild knee pain on lunges. Swapped to split squats and reduced volume for two weeks.', category: 'Injury/Pain', severity: 'High' },
    { title: 'Shoulder impingement history', content: 'Old shoulder issue flares on overhead pressing. Use landmine press instead.', category: 'Injury/Pain', severity: 'Medium' },
    { title: 'Skipping breakfast', content: 'Skips breakfast most weekdays. Advised on meal timing and added a portable option.', category: 'Nutrition', severity: 'Low' },
    { title: 'Weekend overeating', content: 'Adherence drops on weekends. Planned one flexible meal to keep it sustainable.', category: 'Adherence', severity: 'Medium' },
    { title: 'Great adherence', content: 'Excellent compliance with the nutrition plan this month. Hit protein target 6 of 7 days.', category: 'Adherence', severity: null },
    { title: 'Low water intake', content: 'Hydration is a recurring issue. Set a 3 L target and a reminder schedule.', category: 'Nutrition', severity: 'Low' },
    { title: 'Poor sleep', content: 'Sleeping 5-6 hours. Recommended a fixed bedtime and magnesium before bed.', category: 'General', severity: 'Medium' },
    { title: 'Wants more frequency', content: 'Asked to increase training from 3 to 4 days per week. Reviewing recovery first.', category: 'General', severity: null },
    { title: 'Stress at work', content: 'Busy period at work, missing sessions. Switched to a shorter 45 minute format.', category: 'Mindset', severity: 'Medium' },
    { title: 'Lower back tightness', content: 'Tight lower back after deadlifts. Added hip mobility and reduced the top set.', category: 'Injury/Pain', severity: 'Medium' },
    { title: 'Plateau', content: 'Weight stalled for 3 weeks. Reducing calories by 150 and adding two cardio sessions.', category: 'Nutrition', severity: 'Low' },
    { title: 'Detail oriented', content: 'Appreciates written instructions and wants the reasoning behind each change.', category: 'General', severity: null },
];

// ── Form answers ───────────────────────────────────────────────────────────
export const TEXT_ANSWERS = [
    'No issues to report.', 'Slight knee soreness after leg day, nothing serious.', 'Feeling good overall.',
    'Skipped breakfast twice but otherwise fine.', 'Recovering from a cold, energy was lower than usual.',
    'Had a family event on Friday so I ate out once.', 'Felt strong on all lifts this week.',
    'Travelled for work, trained at a hotel gym.', 'تمام الحمد لله، ملتزم بالخطة.', 'كان عندي إرهاق شوية في نص الأسبوع.',
    'مفيش أي مشاكل.', 'وجع بسيط في الكتف بعد تمرين الضغط.',
];
export const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
export const GOAL_LABELS = ['Build muscle', 'Lose fat', 'Improve endurance', 'General fitness'];

// ── Fallback libraries (only used if the workspace somehow has none) ────────
export const FALLBACK_FOODS: Array<[string, string, string, number, number, number, number]> = [
    // name_en, name_ar, category, kcal, protein, carbs, fats  (per 100 g)
    ['Chicken Breast', 'صدور دجاج', 'Protein', 165, 31, 0, 3.6], ['Lean Beef', 'لحم بقري قليل الدهن', 'Protein', 217, 26, 0, 12],
    ['Tuna (canned)', 'تونة', 'Protein', 116, 26, 0, 1], ['Eggs', 'بيض', 'Protein', 155, 13, 1.1, 11],
    ['Salmon', 'سلمون', 'Protein', 208, 20, 0, 13], ['Greek Yogurt', 'زبادي يوناني', 'Dairy', 59, 10, 3.6, 0.4],
    ['Cottage Cheese', 'جبنة قريش', 'Dairy', 98, 11, 3.4, 4.3], ['White Rice', 'أرز أبيض', 'Carbs', 130, 2.7, 28, 0.3],
    ['Brown Rice', 'أرز بني', 'Carbs', 123, 2.7, 26, 1], ['Oats', 'شوفان', 'Carbs', 389, 17, 66, 7],
    ['Sweet Potato', 'بطاطا', 'Carbs', 86, 1.6, 20, 0.1], ['Whole Wheat Bread', 'عيش بلدي', 'Carbs', 247, 13, 41, 3.4],
    ['Pasta', 'مكرونة', 'Carbs', 158, 5.8, 31, 0.9], ['Banana', 'موز', 'Fruit', 89, 1.1, 23, 0.3],
    ['Apple', 'تفاح', 'Fruit', 52, 0.3, 14, 0.2], ['Broccoli', 'بروكلي', 'Vegetables', 34, 2.8, 7, 0.4],
    ['Cucumber', 'خيار', 'Vegetables', 15, 0.7, 3.6, 0.1], ['Mixed Salad', 'سلطة', 'Vegetables', 20, 1.5, 3.5, 0.2],
    ['Olive Oil', 'زيت زيتون', 'Fats', 884, 0, 0, 100], ['Almonds', 'لوز', 'Fats', 579, 21, 22, 50],
    ['Peanut Butter', 'زبدة فول سوداني', 'Fats', 588, 25, 20, 50], ['Avocado', 'أفوكادو', 'Fats', 160, 2, 9, 15],
];

export const FALLBACK_EXERCISES: Array<[string, string, string, string]> = [
    ['Barbell Bench Press', 'Chest', 'Barbell', 'sets_reps'], ['Incline Dumbbell Press', 'Chest', 'Dumbbell', 'sets_reps'],
    ['Cable Fly', 'Chest', 'Cable Machine', 'sets_reps'], ['Pull-up', 'Back', 'Pull-up Bar', 'sets_reps'],
    ['Bent-over Row', 'Back', 'Barbell', 'sets_reps'], ['Lat Pulldown', 'Back', 'Cable Machine', 'sets_reps'],
    ['Overhead Press', 'Shoulders', 'Barbell', 'sets_reps'], ['Lateral Raise', 'Shoulders', 'Dumbbell', 'sets_reps'],
    ['Barbell Curl', 'Biceps', 'Barbell', 'sets_reps'], ['Hammer Curl', 'Biceps', 'Dumbbell', 'sets_reps'],
    ['Triceps Pushdown', 'Triceps', 'Cable Machine', 'sets_reps'], ['Skull Crusher', 'Triceps', 'EZ Bar', 'sets_reps'],
    ['Back Squat', 'Quadriceps', 'Barbell', 'sets_reps'], ['Leg Press', 'Quadriceps', 'Machine', 'sets_reps'],
    ['Romanian Deadlift', 'Hamstrings', 'Barbell', 'sets_reps'], ['Leg Curl', 'Hamstrings', 'Machine', 'sets_reps'],
    ['Hip Thrust', 'Glutes', 'Barbell', 'sets_reps'], ['Calf Raise', 'Calves', 'Machine', 'sets_reps'],
    ['Plank', 'Abs', 'Bodyweight', 'sets_reps'], ['Cable Crunch', 'Abs', 'Cable Machine', 'sets_reps'],
    ['Treadmill Run', 'Cardio', 'Machine', 'time_based'], ['Stationary Bike', 'Cardio', 'Machine', 'time_based'],
];
