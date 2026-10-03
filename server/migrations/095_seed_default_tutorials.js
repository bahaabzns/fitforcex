// Seeds every coach-portal page with the general "How to use FitForce" video
// until page-specific videos are recorded. Admins replace individual pages from
// admin /tutorials; ON CONFLICT DO NOTHING means re-running (or running after an
// admin already assigned a page) never overwrites their choice.
// PAGE_KEYS mirrors client/lib/tutorialPages.js — pages added there later are
// simply not seeded and stay unassigned until an admin picks a video.
const DEFAULT_URL = 'https://www.youtube.com/watch?v=j4p2_PcHV_M';
const DEFAULT_TITLE = 'How to use FitForce';
const PAGE_KEYS = [
    'dashboard',
    'clients.list',
    'clients.detail.overview',
    'clients.detail.nutrition',
    'clients.detail.training',
    'clients.detail.forms',
    'clients.detail.transactions',
    'clients.detail.observations',
    'clients.detail.transformation',
    'clients.detail.workoutLogs',
    'nutrition.foodItems',
    'nutrition.foodCategories',
    'training.exercises',
    'training.equipment',
    'training.muscleGroups',
    'finance.transactions',
    'finance.packages',
    'finance.paymentMethods',
    'forms.list',
    'forms.metrics',
    'settings.overview',
    'settings.account',
    'settings.workspace',
    'settings.subscription',
    'settings.billing',
    'settings.clientExperience',
    'settings.advanced',
    'settings.pdf',
    'settings.profile',
    'messenger',
    'team',
    'plansQueue',
];

exports.up = (pgm) => {
    const values = PAGE_KEYS.map((key) => `(gen_random_uuid()::text, '${key}', '${DEFAULT_URL}', '${DEFAULT_TITLE}')`).join(',\n');
    pgm.sql(`
        INSERT INTO "page_tutorials" ("id", "page_key", "youtube_url", "title")
        VALUES ${values}
        ON CONFLICT ("page_key") DO NOTHING;
    `);
};

// Only removes rows still pointing at the seeded video, so admin-chosen ones survive.
exports.down = (pgm) => {
    pgm.sql(`DELETE FROM "page_tutorials" WHERE "youtube_url" = '${DEFAULT_URL}';`);
};
