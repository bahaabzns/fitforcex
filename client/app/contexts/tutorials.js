'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/axios';

const TutorialsContext = createContext(null);

// Fetches every assigned tutorial once per coach-portal session and exposes it
// as a page_key -> { youtube_url, title } map, so TutorialButton doesn't issue
// a request on every navigation. A failed fetch just means no buttons show —
// not worth surfacing as an error to the coach.
export function TutorialsProvider({ children }) {
    const [tutorials, setTutorials] = useState({});

    useEffect(() => {
        let cancelled = false;
        api.get('/api/tutorials')
            .then((res) => {
                if (cancelled) return;
                const byKey = {};
                for (const row of res.data ?? []) byKey[row.page_key] = row;
                setTutorials(byKey);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    return (
        <TutorialsContext.Provider value={tutorials}>
            {children}
        </TutorialsContext.Provider>
    );
}

// Returns { youtube_url, title } for the given page key, or null if unassigned.
export function useTutorial(pageKey) {
    const tutorials = useContext(TutorialsContext);
    if (!pageKey || !tutorials) return null;
    return tutorials[pageKey] ?? null;
}
