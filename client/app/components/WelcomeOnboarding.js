'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { Dumbbell, Apple, Boxes, Layers, ClipboardList, CalendarCheck, Check, ArrowRight } from 'lucide-react';
import { Button } from '@heroui/react/button';

// Post-signup "aha moment". Polls the Default Libraries clone status for the new
// workspace and, once ready, shows what was loaded plus the first-client CTA.
// Rendered as a full-screen gate by the dashboard for brand-new coaches.

const POLL_MS = 1500;

const ITEMS = [
    { key: 'exercises',      label: 'exercises loaded',       icon: Dumbbell },
    { key: 'foodItems',      label: 'food items loaded',      icon: Apple },
    { key: 'equipment',      label: 'equipment types loaded', icon: Boxes },
    { key: 'muscleGroups',   label: 'muscle groups loaded',   icon: Layers },
];

// Default form templates cloned into the workspace — shown as a ready/not-ready
// state rather than a count (a coach starts with one of each).
const FORMS = [
    { key: 'assessmentForms', label: 'Assessment form ready', icon: ClipboardList },
    { key: 'checkInForms',    label: 'Check-in form ready',   icon: CalendarCheck },
];

export default function WelcomeOnboarding({ workspaceSlug, onDone }) {
    const router = useRouter();
    const [status, setStatus] = useState('pending');   // pending | cloning | ready | failed
    const [counts, setCounts] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        let cancelled = false;

        async function poll() {
            try {
                const res = await api.get('/api/auth/clone-status');
                if (cancelled) return;
                setStatus(res.data.status);
                setCounts(res.data.counts);
                if (res.data.status !== 'ready' && res.data.status !== 'failed') {
                    timer.current = setTimeout(poll, POLL_MS);
                }
            } catch {
                if (!cancelled) timer.current = setTimeout(poll, POLL_MS);
            }
        }

        poll();
        return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
    }, []);

    function dismiss(navigateTo) {
        onDone?.();
        if (navigateTo) router.push(navigateTo);
    }

    const ready = status === 'ready';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl p-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                    <Dumbbell className="text-primary" size={26} />
                </div>

                <h1 className="text-2xl font-bold text-foreground">Welcome to FitForce</h1>

                {!ready && status !== 'failed' && (
                    <>
                        <p className="text-sm text-muted-foreground mt-2">Setting up your workspace…</p>
                        <div className="w-9 h-9 my-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-xs text-muted-foreground">Loading your exercise and food libraries.</p>
                    </>
                )}

                {status === 'failed' && (
                    <>
                        <p className="text-sm text-destructive mt-3">
                            We hit a snag preparing your libraries. You can still start — your libraries will be available shortly.
                        </p>
                        <Button variant="primary" className="mt-6" onClick={() => dismiss(`/${workspaceSlug}/clients`)}>
                            Continue <ArrowRight size={15} className="ml-1.5" />
                        </Button>
                    </>
                )}

                {ready && counts && (
                    <>
                        <p className="text-sm text-muted-foreground mt-2">Your workspace is ready.</p>

                        <div className="w-full mt-6 flex flex-col gap-2.5">
                            {ITEMS.map(({ key, label, icon: Icon }) => (
                                <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                                    <Check className="text-green-500 shrink-0" size={18} />
                                    <Icon size={16} className="text-muted-foreground shrink-0" />
                                    <span className="text-sm text-foreground text-left flex-1">
                                        <span className="font-semibold">{(counts[key] ?? 0).toLocaleString()}</span> {label}
                                    </span>
                                </div>
                            ))}
                            {FORMS.map(({ key, label, icon: Icon }) => (
                                <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                                    <Check className="text-green-500 shrink-0" size={18} />
                                    <Icon size={16} className="text-muted-foreground shrink-0" />
                                    <span className="text-sm text-foreground text-left flex-1">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <Button variant="primary" size="lg" className="mt-7 w-full" onClick={() => dismiss(`/${workspaceSlug}/clients`)}>
                            Create Your First Client <ArrowRight size={16} className="ml-1.5" />
                        </Button>
                        <button onClick={() => dismiss(null)} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            Skip for now
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
