'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";

// One shared copy of the getting-started status for the whole coach app (header button, dashboard card, arrow guide
// and celebration all read it), so a step that finishes anywhere shows up everywhere at once.
const POLL_MS = 5000;

const GettingStartedContext = createContext({ status: null, ready: true, dismiss: async () => {}, refresh: () => {}, celebration: null, clearCelebration: () => {} });
export const useGettingStartedContext = () => useContext(GettingStartedContext);

export default function GettingStartedProvider({ children }) {
    const pathname = usePathname();
    const [status, setStatus] = useState(null);
    const [ready, setReady] = useState(false);   // true once the first read has finished, whether or not it worked
    const [celebration, setCelebration] = useState(null);
    const doneBefore = useRef(null);   // keys that were done at the previous read; null until the first read

    const refresh = useCallback(() => {
        api.get('/api/getting-started').then(res => {
            const next = res.data;
            const doneNow = new Set(next.steps.filter(step => step.done).map(step => step.key));
            const before = doneBefore.current;
            // Celebrate only a step that finished while the coach was here, never one that was already done on load.
            if (before) {
                const justDone = [...doneNow].find(key => !before.has(key));
                if (justDone) setCelebration({ id: Date.now(), key: justDone, all: next.steps.length > 0 && doneNow.size === next.steps.length });
            }
            doneBefore.current = doneNow;
            setStatus(next);
        }).catch(() => {}).finally(() => setReady(true));
    }, []);

    useEffect(() => { refresh(); }, [refresh, pathname]);
    useEffect(() => {
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [refresh]);

    // Steps finish on other pages without a page change (saving a diet, a client signing in), so keep reading while
    // the checklist is still showing. It stops by itself once everything is done or hidden.
    const visible = !!status?.visible;
    useEffect(() => {
        if (!visible) return undefined;
        const timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
        return () => clearInterval(timer);
    }, [visible, refresh]);

    const clearCelebration = useCallback(() => setCelebration(null), []);

    const dismiss = useCallback(async () => {
        setStatus(current => (current ? { ...current, visible: false } : current));
        try {
            await api.post('/api/getting-started/dismiss');
        } catch {
            // Hidden for this session either way; it would simply show again next time.
        }
    }, []);

    return (
        <GettingStartedContext.Provider value={{ status, ready, dismiss, refresh, celebration, clearCelebration }}>
            {children}
        </GettingStartedContext.Provider>
    );
}
