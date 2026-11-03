'use client';

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import LpNav from "./LpNav";
import LpHero from "./LpHero";
import LpProblem from "./LpProblem";
import LpDay from "./LpDay";
import LpAppDemo from "./LpAppDemo";
import LpCoaches from "./LpCoaches";
import LpPricing from "./LpPricing";
import LpFaq from "./LpFaq";
import { LpFinalCta, LpFooter, LpFloating } from "./LpCta";

export default function LandingPage() {
    const [user, setUser] = useState(null);

    // Identity is non-blocking: the page renders for everyone straight away, and only the
    // calls to action swap to "Go to dashboard" once a session is confirmed.
    useEffect(() => {
        api.get('/api/auth/me')
            .then((response) => setUser(response.data))
            .catch(() => setUser(null));
    }, []);

    const dashboardUrl = user?.currentWorkspace?.slug ? `/${user.currentWorkspace.slug}/dashboard` : null;

    return (
        <main className="lp">
            <LpNav dashboardUrl={dashboardUrl} />
            <LpHero dashboardUrl={dashboardUrl} />
            <LpProblem />
            <LpDay />
            <LpAppDemo />
            <LpCoaches />
            <LpPricing />
            <LpFaq />
            <LpFinalCta dashboardUrl={dashboardUrl} />
            <LpFooter />
            <LpFloating dashboardUrl={dashboardUrl} />
        </main>
    );
}
