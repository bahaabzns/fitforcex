// The key the Plans Queue table's view state (search, filters, sort, page) is saved under in sessionStorage
// (`datatable:<key>`, see DataTable's persistKey). One definition, because the Operations drill-downs
// (operations/queueDrilldown.js) write a filter into that same entry before opening the queue.
//
// "v2": the Form filter used to hold form titles and now holds form ids, so a view saved by the older page must
// not be restored into it. Bump it again whenever a saved filter's meaning changes.
export function plansQueuePersistKey({ isMainView, workspaceSlug }) {
    return `plans-queue-v2-${isMainView ? "main" : "history"}-${workspaceSlug}`;
}
