"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";
import { getSeenPlanKey, getSeenIds, planKey, NAV_BADGES_REFRESH_EVENT } from "@/lib/lastSeenStore";

const POLL_MS = 15000;
const ACTIONABLE_FORM_STATUSES = new Set(["pending", "scheduled"]);
const EMPTY_BADGES = { nutrition: false, training: false, forms: false, messages: false };

async function checkPlanUnread(endpoint, moduleName) {
    try {
        const { data } = await api.get(endpoint);
        return planKey(data.id, data.activated_at) !== getSeenPlanKey(moduleName);
    } catch {
        return false;
    }
}

async function checkFormsUnread() {
    try {
        const { data } = await api.get("/api/client-portal/form-requests");
        const seen = getSeenIds("forms");
        return (data ?? []).some((r) => ACTIONABLE_FORM_STATUSES.has(r.status) && !seen.has(r.id));
    } catch {
        return false;
    }
}

// Reuses the notifications system's own read_at (opening a thread already
// marks it read server-side — see getMessages in clientPortal.controller.ts)
// instead of separate client-side tracking, matching the mobile app's
// hasUnreadMessageProvider exactly.
async function checkMessagesUnread() {
    try {
        const { data } = await api.get("/api/client-portal/notifications", { params: { unread: true, limit: 30 } });
        return (data ?? []).some((n) => n.type === "message.received");
    } catch {
        return false;
    }
}

// Drives the bottom-nav "new content" dots — web analog of the mobile app's
// unread_indicators.dart. All four checks resolve in parallel and land in a
// single setState so a poll tick never causes more than one re-render.
export function useNavBadges(access) {
    const [badges, setBadges] = useState(EMPTY_BADGES);

    const refresh = useCallback(async () => {
        const can = (key) => !access || access[key] === true;

        const [nutrition, training, forms, messages] = await Promise.all([
            can("view_nutrition_plans")
                ? checkPlanUnread("/api/client-portal/active-plan", "nutrition")
                : Promise.resolve(false),
            can("view_training_plans") || can("view_progress_history")
                ? checkPlanUnread("/api/client-portal/active-training-plan", "training")
                : Promise.resolve(false),
            can("view_assessments") || can("view_checkins")
                ? checkFormsUnread()
                : Promise.resolve(false),
            can("allow_messaging")
                ? checkMessagesUnread()
                : Promise.resolve(false),
        ]);

        setBadges({ nutrition, training, forms, messages });
    }, [access]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh() is async; its only setState call is after the awaited Promise.all, never synchronous during this effect
        refresh();
        const interval = setInterval(refresh, POLL_MS);
        window.addEventListener(NAV_BADGES_REFRESH_EVENT, refresh);
        return () => {
            clearInterval(interval);
            window.removeEventListener(NAV_BADGES_REFRESH_EVENT, refresh);
        };
    }, [refresh]);

    return badges;
}
