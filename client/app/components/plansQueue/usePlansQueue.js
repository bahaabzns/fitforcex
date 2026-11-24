"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import { toQueueParams } from "@/app/components/plansQueue/queueParams";

// Data layer of the Plans Queue table. The server does the searching, filtering, sorting and paging (see
// GET /api/forms/queue?page=…), so the table only ever holds one page; these hooks fetch that page and the
// few numbers the table used to work out from "every row" (see /api/forms/queue/summary).

/**
 * One page of the queue for `view` ("need-action" | "all"). The table reports its query through `onQueryChange`
 * (search, filters, sort, page, page size); this fetches it, ignoring any response that a newer query has
 * already replaced. `includeId` (the row a coach just finished in a builder) is asked for on the first
 * request only, and comes back as `includedItem`. A change to `reloadToken` refetches the current query.
 */
export function usePlansQueueRows({ view, includeId = null, reloadToken = 0 }) {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(null);
    const [includedItem, setIncludedItem] = useState(null);
    const [error, setError] = useState("");
    const [isFetching, setIsFetching] = useState(true);
    const [fetchToken, setFetchToken] = useState(0);

    const queryRef = useRef(null);
    const latestRequestRef = useRef(0);
    const pendingIncludeIdRef = useRef(includeId);

    const onQueryChange = useCallback((query) => {
        queryRef.current = query;
        setFetchToken((n) => n + 1);
    }, []);
    const refetch = useCallback(() => setFetchToken((n) => n + 1), []);

    useEffect(() => {
        // Nothing to fetch until the table has reported its query. fetchToken 0 is the mount render: the table's
        // own mount effect reports the query (and bumps the token) right after, so fetching here too would send
        // the same request twice.
        if (!queryRef.current || fetchToken === 0) return;
        const requestNumber = ++latestRequestRef.current;
        setIsFetching(true);

        api.get("/api/forms/queue", { params: toQueueParams({ view, ...queryRef.current, includeId: pendingIncludeIdRef.current }) })
            .then((res) => {
                if (requestNumber !== latestRequestRef.current) return;
                pendingIncludeIdRef.current = null;
                setRows(res.data.items || []);
                setTotal(res.data.total ?? 0);
                // Later pages and filters don't ask for it again, so keep the one the first response brought.
                if (res.data.includedItem) setIncludedItem(res.data.includedItem);
                setError("");
            })
            .catch((err) => {
                if (requestNumber !== latestRequestRef.current) return;
                setError(err.response?.data?.error || "Failed to load plans queue");
            })
            .finally(() => {
                if (requestNumber === latestRequestRef.current) setIsFetching(false);
            });
    }, [fetchToken, reloadToken, view]);

    return { rows, total, includedItem, error, isFetching, onQueryChange, refetch };
}

const EMPTY_SUMMARY = { needActionByAssignee: {}, unassignedNeedAction: 0, packages: [], formIds: [] };

/** Per-assignee need-action counts and the package/form options for `view`. `refresh` re-reads them (e.g. after assigning). */
export function usePlansQueueSummary({ view, reloadToken = 0 }) {
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [refreshToken, setRefreshToken] = useState(0);
    const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

    useEffect(() => {
        let cancelled = false;
        api.get("/api/forms/queue/summary", { params: { view } })
            .then((res) => { if (!cancelled) setSummary({ ...EMPTY_SUMMARY, ...res.data }); })
            .catch(() => { /* the counts and filter options are extras — the table works without them */ });
        return () => { cancelled = true; };
    }, [view, reloadToken, refreshToken]);

    return { summary, refresh };
}

/** Every row matching the table's current search/filters (id, status, postAction), for "select all matching" across pages. */
export async function fetchMatchingQueueRows({ view, search, filters, sortKey, sortDirection }) {
    const params = toQueueParams({ view, search, filters, sortKey, sortDirection });
    const res = await api.get("/api/forms/queue/ids", { params });
    return { items: res.data.items || [], capped: !!res.data.capped };
}
