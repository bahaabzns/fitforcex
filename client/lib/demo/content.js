// Curated demo content: chat, foods the visitor can swap to, and Arabic wording for the few
// recorded strings that are stored as plain text (plan and day names, coach notes).

export const DEMO_MESSAGES = {
    en: [
        { from: "team", body: "Hi Layla! Did you get a chance to look at your new plan? Tell me what you think after the first week." },
        { from: "client", body: "I did, coach! The meals are great, I just don't know what to use instead of chicken some days." },
        { from: "team", body: "You can swap any food for another from the same group with the Swap Food button, and the calories stay the same." },
        { from: "client", body: "Perfect, I tried it and it worked. I also trained 4 times this week." },
        { from: "team", body: "Well done! Keep it up, and send me your weekly check-in on Sunday." },
    ],
    ar: [
        { from: "team", body: "أهلًا ليلى! شفتي خطتك الجديدة؟ قوليلي رأيك بعد أول أسبوع." },
        { from: "client", body: "شفتها يا كابتن، الأكل حلو بس مش عارفة أبدّل الفراخ بإيه في بعض الأيام." },
        { from: "team", body: "تقدري تبدّلي أي صنف بصنف تاني من نفس المجموعة من زرار \"استبدال الطعام\"، والسعرات بتفضل زي ما هي." },
        { from: "client", body: "تمام جدًا، جرّبت وزبط. وكمان اتمرنت 4 مرات الأسبوع ده." },
        { from: "team", body: "برافو عليكي! كمّلي كده، وابعتيلي المتابعة الأسبوعية يوم الأحد." },
    ],
};

export const DEMO_REPLY = {
    en: "Got your message! I'll get back to you soon. Keep it up 💪",
    ar: "وصلتني رسالتك! هرد عليكي في أقرب وقت. كمّلي كده 💪",
};

export const FOOD_GROUP_LABELS = {
    protein: { en: "Protein", ar: "بروتين" },
    carbs: { en: "Carbohydrates", ar: "كربوهيدرات" },
    veg: { en: "Vegetables", ar: "خضروات" },
};

// Per 100 g. `match` is a lowercase fragment used to recognise the plan's own foods.
export const FOOD_CATALOG = [
    { id: "demo-food-chicken", group: "protein", match: "chicken", en: "Chicken Breast", ar: "صدور دجاج", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
    { id: "demo-food-salmon", group: "protein", match: "salmon", en: "Salmon", ar: "سلمون", kcal: 208, protein: 20, carbs: 0, fat: 13 },
    { id: "demo-food-tuna", group: "protein", match: "tuna", en: "Tuna (canned)", ar: "تونة معلبة", kcal: 116, protein: 26, carbs: 0, fat: 1 },
    { id: "demo-food-eggs", group: "protein", match: "egg", en: "Eggs", ar: "بيض", kcal: 143, protein: 13, carbs: 1, fat: 10 },
    { id: "demo-food-meat", group: "protein", match: "meat", en: "Lean Beef", ar: "لحمة قليلة الدهن", kcal: 175, protein: 26, carbs: 0, fat: 8 },
    { id: "demo-food-turkey", group: "protein", match: "turkey", en: "Turkey Breast", ar: "صدور رومي", kcal: 135, protein: 30, carbs: 0, fat: 1 },
    { id: "demo-food-cottage", group: "protein", match: "cottage", en: "Cottage Cheese", ar: "جبنة قريش", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
    { id: "demo-food-brown-rice", group: "carbs", match: "brown rice", en: "Brown Rice", ar: "أرز بني", kcal: 123, protein: 2.7, carbs: 25.6, fat: 1 },
    { id: "demo-food-white-rice", group: "carbs", match: "white rice", en: "White Rice", ar: "أرز أبيض", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { id: "demo-food-oats", group: "carbs", match: "oat", en: "Oats", ar: "شوفان", kcal: 379, protein: 13, carbs: 67, fat: 6.5 },
    { id: "demo-food-sweet-potato", group: "carbs", match: "potato", en: "Sweet Potato", ar: "بطاطا حلوة", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
    { id: "demo-food-pasta", group: "carbs", match: "pasta", en: "Pasta", ar: "مكرونة", kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
    { id: "demo-food-bread", group: "carbs", match: "bread", en: "Whole Wheat Bread", ar: "عيش توست أسمر", kcal: 247, protein: 13, carbs: 41, fat: 3.4 },
    { id: "demo-food-broccoli", group: "veg", match: "broccoli", en: "Broccoli", ar: "بروكلي", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
    { id: "demo-food-spinach", group: "veg", match: "spinach", en: "Spinach", ar: "سبانخ", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
    { id: "demo-food-cucumber", group: "veg", match: "cucumber", en: "Cucumber", ar: "خيار", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
    { id: "demo-food-zucchini", group: "veg", match: "zucchini", en: "Zucchini", ar: "كوسة", kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
];

const AR_TEXT = {
    "Nutrition Plan": "خطة التغذية",
    "Training Plan": "خطة التدريب",
    "Training days": "أيام التمرين",
    "Rest days": "أيام الراحة",
    Breakfast: "الفطار",
    Lunch: "الغدا",
    Dinner: "العشا",
    "Pre-workout": "قبل التمرين",
    "Post-workout": "بعد التمرين",
    "Eat to the plan on training days, weigh food raw where possible": "التزم بالخطة في أيام التمرين، ووزن الأكل نيّء لو أمكن.",
    "Can be prepped the night before": "ممكن تجهّزه من الليلة اللي قبلها",
    "Drink 500 ml of water with this meal": "اشرب 500 مل مياه مع الوجبة دي",
    "Check-in form ready to fill": "نموذج المتابعة جاهز للتعبئة",
    "A new check-in is ready for you": "نموذج متابعة جديد جاهز ليكي",
    "Scapular Protraction": "تمرين ضم الكتف",
    RDL: "ديدليفت روماني",
    "Bulgarian split squats supported": "سكوات بلغاري",
    "Incline Db Chest Press": "ضغط صدر بالدمبل مائل",
};

const AR_DAY_PARTS = {
    "Upper Body": "الجزء العلوي",
    Legs: "الأرجل",
    "Glutes & Hamstrings": "الأرداف والفخذ الخلفي",
};

function arabicText(value) {
    if (AR_TEXT[value]) return AR_TEXT[value];
    const day = value.match(/^Day (\d+) · (.+)$/);
    if (day) return `اليوم ${day[1]} · ${AR_DAY_PARTS[day[2]] ?? day[2]}`;
    return value;
}

// Returns a copy; in Arabic, known plain-text strings are swapped for their Arabic wording.
export function localizeDeep(value) {
    const copy = JSON.parse(JSON.stringify(value));
    if (typeof document === "undefined" || document.documentElement.lang !== "ar") return copy;
    const walk = (node) => {
        if (Array.isArray(node)) return node.map(walk);
        if (node && typeof node === "object") {
            Object.keys(node).forEach((key) => { node[key] = typeof node[key] === "string" ? arabicText(node[key]) : walk(node[key]); });
        }
        return node;
    };
    return walk(copy);
}
