// Drill-down from an Operations number into the Plans Queue. The queue's
// DataTable restores its filters from sessionStorage (`datatable:<persistKey>`,
// see DataTable.js's persistKey), so seeding that entry before navigating
// opens the queue already narrowed, with no extra query-param plumbing.
// The key must match PlansQueueTable's persistKey for the Main view.

const ACTION_TO_POST_ACTION = { nutrition: "nutrition-plan", workout: "workout-plan" };

export function openQueueWithFilters(router, workspaceSlug, { assignedTo, packageName, action, type } = {}) {
    const rules = [];
    const addRule = (colKey, value) => rules.push({ id: `ops-${colKey}`, colKey, value });

    // assignedTo: undefined = no filter, null = unassigned, string = that user.
    if (assignedTo !== undefined) addRule("assignedTo", [assignedTo]);
    if (packageName) addRule("clientPackage", [packageName]);
    if (action) addRule("postAction", [ACTION_TO_POST_ACTION[action]]);
    if (type) addRule("formType", [type]);

    try {
        sessionStorage.setItem(
            `datatable:plans-queue-main-${workspaceSlug}`,
            JSON.stringify({ filterRules: rules, currentPage: 1 }),
        );
    } catch {
        // sessionStorage can be unavailable (private mode); the queue still opens, just unfiltered.
    }
    router.push(`/${workspaceSlug}/plans-queue`);
}
