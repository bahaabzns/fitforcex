// Maps the Plans Queue table's query onto the API's parameters (GET /api/forms/queue and its siblings).
// Pure on purpose — no imports — so it is unit-testable and shared by the list, the summary and "select all matching".

// DataTable column key -> the key the API knows. Everything else (clientCode, clientName, clientPackage,
// formType, postAction, actions, status, assignedTo, label, requestedAt, submittedAt, actionTakenAt) is the same.
const FILTER_KEY_BY_COLUMN = { formTitle_en: "formId" };
const SORT_KEY_BY_COLUMN = { formTitle_en: "formTitle" };

/** Turns the table's query ({ search, filters: [{ colKey, value }], sortKey, sortDirection, page, pageSize }) into API params. */
export function toQueueParams({ view, search, filters = [], sortKey, sortDirection, page, pageSize, includeId }) {
    const filterObject = {};
    for (const rule of filters) filterObject[FILTER_KEY_BY_COLUMN[rule.colKey] ?? rule.colKey] = rule.value;

    const params = { view };
    if (page !== undefined) params.page = page;
    if (pageSize !== undefined) params.pageSize = pageSize;
    if (search) params.search = search;
    if (filters.length > 0) params.filters = JSON.stringify(filterObject);
    if (sortKey) {
        params.sort = SORT_KEY_BY_COLUMN[sortKey] ?? sortKey;
        params.dir = sortDirection === "desc" ? "desc" : "asc";
    }
    if (includeId) params.includeId = includeId;
    return params;
}
