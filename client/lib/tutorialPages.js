// Canonical list of coach-portal pages a tutorial video can be assigned to.
// Single source of truth for both the admin "Tutorials" screen (which pages
// are assignable) and the coach-side TutorialButton (which page is this?).
// Add a new page here when a new route is added — nothing else needs to know
// about it. Keyed by a stable `key`, not the route itself, so renaming a route
// doesn't orphan the assignment silently (see the admin page's "unmatched"
// section, which surfaces DB rows whose key no longer matches any entry here).
export const TUTORIAL_PAGES = [
    { key: 'dashboard', label: 'Dashboard', section: 'Dashboard', match: (p) => p === '/dashboard' },

    { key: 'clients.list', label: 'Clients — List', section: 'Clients', match: (p) => p === '/clients' },
    { key: 'clients.detail.overview', label: 'Client Detail — Overview', section: 'Clients', match: (p) => /^\/clients\/[^/]+$/.test(p) },
    { key: 'clients.detail.nutrition', label: 'Client Detail — Nutrition', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/nutrition$/.test(p) },
    { key: 'clients.detail.training', label: 'Client Detail — Training', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/training$/.test(p) },
    { key: 'clients.detail.forms', label: 'Client Detail — Forms', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/forms$/.test(p) },
    { key: 'clients.detail.transactions', label: 'Client Detail — Transactions', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/transactions$/.test(p) },
    { key: 'clients.detail.observations', label: 'Client Detail — Observations', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/observations$/.test(p) },
    { key: 'clients.detail.transformation', label: 'Client Detail — Transformation', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/transformation$/.test(p) },
    { key: 'clients.detail.workoutLogs', label: 'Client Detail — Workout Logs', section: 'Clients', match: (p) => /^\/clients\/[^/]+\/workout-logs$/.test(p) },

    { key: 'nutrition.foodItems', label: 'Nutrition — Food Items', section: 'Nutrition', match: (p) => p === '/nutrition/food-items' },
    { key: 'nutrition.foodCategories', label: 'Nutrition — Food Categories', section: 'Nutrition', match: (p) => p === '/nutrition/food-categories' },

    { key: 'training.exercises', label: 'Training — Exercises', section: 'Training', match: (p) => p === '/training/exercises' },
    { key: 'training.equipment', label: 'Training — Equipment', section: 'Training', match: (p) => p === '/training/equipment' },
    { key: 'training.muscleGroups', label: 'Training — Muscle Groups', section: 'Training', match: (p) => p === '/training/muscle-groups' },

    { key: 'finance.transactions', label: 'Finance — Transactions', section: 'Finance', match: (p) => p === '/finance/transactions' },
    { key: 'finance.packages', label: 'Finance — Packages', section: 'Finance', match: (p) => p === '/finance/packages' },
    { key: 'finance.paymentMethods', label: 'Finance — Payment Methods', section: 'Finance', match: (p) => p === '/finance/payment-methods' },

    { key: 'forms.list', label: 'Forms', section: 'Forms', match: (p) => p === '/forms' },
    { key: 'forms.metrics', label: 'Forms — Metrics', section: 'Forms', match: (p) => p === '/forms/metrics' },

    { key: 'settings.overview', label: 'Settings — Overview', section: 'Settings', match: (p) => p === '/settings' },
    { key: 'settings.account', label: 'Settings — Account', section: 'Settings', match: (p) => p === '/settings/account' },
    { key: 'settings.workspace', label: 'Settings — Workspace', section: 'Settings', match: (p) => p === '/settings/workspace' },
    { key: 'settings.subscription', label: 'Settings — Subscription', section: 'Settings', match: (p) => p === '/settings/subscription' },
    { key: 'settings.billing', label: 'Settings — Billing', section: 'Settings', match: (p) => p === '/settings/billing' },
    { key: 'settings.clientExperience', label: 'Settings — Client Experience', section: 'Settings', match: (p) => p === '/settings/client-experience' },
    { key: 'settings.advanced', label: 'Settings — Advanced', section: 'Settings', match: (p) => p === '/settings/advanced' },
    { key: 'settings.pdf', label: 'Settings — PDF Branding', section: 'Settings', match: (p) => p === '/settings/pdf' },
    { key: 'settings.profile', label: 'Settings — Profile', section: 'Settings', match: (p) => p === '/settings/profile' },

    { key: 'messenger', label: 'Messenger', section: 'Other', match: (p) => p === '/messenger' },
    { key: 'team', label: 'Team', section: 'Other', match: (p) => p === '/team' },
    { key: 'plansQueue', label: 'Plans Queue', section: 'Other', match: (p) => p === '/plans-queue' },
];

// pathname is the full Next.js pathname (e.g. "/acme/training/exercises");
// workspaceSlug is the [workspaceSlug] route param. Returns null outside the
// workspace-scoped portal or when no registry entry matches.
export function resolveTutorialPageKey(pathname, workspaceSlug) {
    if (!pathname || !workspaceSlug) return null;
    const prefix = `/${workspaceSlug}`;
    if (!pathname.startsWith(prefix)) return null;
    const relative = pathname.slice(prefix.length) || '/';
    return TUTORIAL_PAGES.find((page) => page.match(relative))?.key ?? null;
}
