"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight, ChevronDown, Play, History, LineChart } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";

function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default function ClientTrainingPage() {
    const t      = useTranslations('portal.training');
    const locale = useLocale();
    const isRTL  = locale === 'ar';

    const [trainingPlan, setTrainingPlan]         = useState(null);
    const [loading, setLoading]                   = useState(true);
    const [noplan, setNoPlan]                     = useState(false);
    const [activeDayIndex, setActiveDayIndex]     = useState(0);
    const [videoOpenId, setVideoOpenId]           = useState(null);
    const [noteExpanded, setNoteExpanded]         = useState(false);
    const [dayNoteExpanded, setDayNoteExpanded]   = useState(false);
    const [isPageScrolled, setIsPageScrolled]     = useState(false);
    const [showLeftShadow, setShowLeftShadow]     = useState(false);
    const [showRightShadow, setShowRightShadow]   = useState(false);

    const tabsScrollRef = useRef(null);
    const router = useRouter();

    function updateTabShadows() {
        const el = tabsScrollRef.current;
        if (!el) return;
        setShowLeftShadow(el.scrollLeft > 0);
        setShowRightShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }

    useEffect(() => {
        const el = tabsScrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateTabShadows);
        const ro = new ResizeObserver(updateTabShadows);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', updateTabShadows); ro.disconnect(); };
    }, [trainingPlan]);

    useEffect(() => {
        api.get("/api/client-portal/active-training-plan")
            .then(res => setTrainingPlan(res.data))
            .catch(e => {
                if (e.response?.status === 404) setNoPlan(true);
                else {
                    const slug = localStorage.getItem('portal_slug');
                    router.push(slug ? `/portal/${slug}` : '/portal');
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    useEffect(() => {
        function handleScroll() { setIsPageScrolled(window.scrollY > 4); }
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    function switchDay(i) {
        setActiveDayIndex(i);
        setVideoOpenId(null);
        setDayNoteExpanded(false);
    }

    function scrollTabsBack() {
        tabsScrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' });
    }
    function scrollTabsForward() {
        tabsScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' });
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
                <Skeleton className="h-8 w-48 rounded-lg mx-auto" />
                <Skeleton className="h-10 rounded-full w-64 mx-auto" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </div>
        );
    }

    const days      = trainingPlan?.days ?? [];
    const activeDay = days[activeDayIndex] ?? null;

    return (
        <div className="max-w-4xl mx-auto flex flex-col">

            {/* ── Sticky header ── */}
            <div className={`sticky top-14 z-30 bg-background px-6 pt-5 pb-4 flex flex-col gap-4 border-b transition-colors duration-200 ${isPageScrolled ? 'border-border' : 'border-transparent'}`}>
                <h1 className="text-2xl font-bold text-foreground text-center">
                    {trainingPlan ? trainingPlan.name : t('title')}
                </h1>

                {/* Day tabs */}
                {!noplan && trainingPlan && days.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                            {/* Back chevron */}
                            <button
                                onClick={isRTL ? scrollTabsForward : scrollTabsBack}
                                className={`shrink-0 p-1 rounded-full transition-opacity text-muted-foreground hover:text-foreground ${
                                    (isRTL ? showRightShadow : showLeftShadow) ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>

                            <div className="relative flex-1 min-w-0">
                                {/* Start shadow */}
                                <div
                                    className={`absolute inset-s-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 ${(isRTL ? showRightShadow : showLeftShadow) ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ background: `linear-gradient(to ${isRTL ? 'left' : 'right'}, var(--color-background), transparent)` }}
                                />
                                {/* End shadow */}
                                <div
                                    className={`absolute inset-e-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 ${(isRTL ? showLeftShadow : showRightShadow) ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ background: `linear-gradient(to ${isRTL ? 'right' : 'left'}, var(--color-background), transparent)` }}
                                />
                                {/* Force dir="ltr" for consistent scrollLeft */}
                                <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide pb-1 w-full" dir="ltr">
                                    <div className={`flex gap-2 w-max ${!showLeftShadow && !showRightShadow ? 'mx-auto' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        {days.map((day, i) => (
                                            <button
                                                key={day.id}
                                                onClick={() => switchDay(i)}
                                                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                                    activeDayIndex === i
                                                        ? "bg-primary border-primary text-primary-foreground"
                                                        : "border-border text-muted-foreground hover:bg-default"
                                                }`}
                                            >
                                                {day.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Forward chevron */}
                            <button
                                onClick={isRTL ? scrollTabsBack : scrollTabsForward}
                                className={`shrink-0 p-1 rounded-full transition-opacity text-muted-foreground hover:text-foreground ${
                                    (isRTL ? showLeftShadow : showRightShadow) ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Scrollable content ── */}
            <div className="px-6 pt-4 pb-6 flex flex-col gap-4">

                {noplan || !trainingPlan ? (
                    <Card>
                        <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                            <p className="text-base font-medium text-muted-foreground">{t('noActivePlan')}</p>
                            <p className="text-sm text-muted-foreground/70">{t('noActivePlanHint')}</p>
                        </Card.Content>
                    </Card>
                ) : (
                    <>
                        {/* Training Mode actions */}
                        {activeDay && (activeDay.exercises ?? []).length > 0 && (
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/portal/training/session?day=${activeDayIndex}`}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                                >
                                    <Play className="w-4 h-4" /> {t('startTraining')}
                                </Link>
                                <Link
                                    href="/portal/training/history"
                                    aria-label={t('history')}
                                    className="shrink-0 p-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-default"
                                >
                                    <History className="w-5 h-5" />
                                </Link>
                                <Link
                                    href="/portal/training/progress"
                                    aria-label={t('progress')}
                                    className="shrink-0 p-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-default"
                                >
                                    <LineChart className="w-5 h-5" />
                                </Link>
                            </div>
                        )}

                        {/* Plan coach note — collapsible */}
                        {trainingPlan.notes && (
                            <div className="border border-yellow-500/40 overflow-hidden" style={{ borderRadius: 'min(32px, var(--radius-3xl))' }}>
                                <button
                                    onClick={() => setNoteExpanded(p => !p)}
                                    className="w-full flex items-start justify-between gap-3 px-4 py-3 cursor-pointer bg-yellow-500/10 hover:bg-yellow-500/15 transition-colors"
                                >
                                    <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                                        <span className="text-xs font-bold text-yellow-600 uppercase tracking-wide">{t('coachNote')}</span>
                                        {!noteExpanded && (
                                            <span dir="auto" className="text-xs text-yellow-600/70 truncate w-full">{trainingPlan.notes.split('\n')[0]}</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`shrink-0 mt-0.5 w-3.5 h-3.5 text-yellow-600 transition-transform duration-200 ${noteExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {noteExpanded && (
                                    <p dir="auto" className="text-sm text-yellow-600 whitespace-pre-wrap px-4 py-3 bg-yellow-500/5">{trainingPlan.notes}</p>
                                )}
                            </div>
                        )}

                        {/* Active day content */}
                        {activeDay && (
                            <>
                                {/* Day note — collapsible */}
                                {activeDay.notes && (
                                    <div className="border border-primary/30 overflow-hidden" style={{ borderRadius: 'min(32px, var(--radius-3xl))' }}>
                                        <button
                                            onClick={() => setDayNoteExpanded(p => !p)}
                                            className="w-full flex items-start justify-between gap-3 px-4 py-3 cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors"
                                        >
                                            <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                                                <span className="text-xs font-bold text-primary uppercase tracking-wide">{t('dayNote')}</span>
                                                {!dayNoteExpanded && (
                                                    <span dir="auto" className="text-xs text-primary/70 truncate w-full">{activeDay.notes.split('\n')[0]}</span>
                                                )}
                                            </div>
                                            <ChevronDown className={`shrink-0 mt-0.5 w-3.5 h-3.5 text-primary transition-transform duration-200 ${dayNoteExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        {dayNoteExpanded && (
                                            <p dir="auto" className="text-sm text-foreground whitespace-pre-wrap px-4 py-3 bg-primary/5">{activeDay.notes}</p>
                                        )}
                                    </div>
                                )}

                                {/* Exercises */}
                                {(activeDay.exercises ?? []).length === 0 ? (
                                    <Card>
                                        <Card.Content className="p-6 flex flex-col items-center justify-center py-12 gap-2 text-center">
                                            <p className="text-sm text-muted-foreground">{t('noExercises')}</p>
                                        </Card.Content>
                                    </Card>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {/* Exercises separator */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-border" />
                                            <span className="text-[11px] font-medium text-muted-foreground/50 tracking-widest uppercase">{t('exercises')}</span>
                                            <div className="flex-1 h-px bg-border" />
                                        </div>

                                        {(activeDay.exercises ?? []).map((exercise, exIdx) => (
                                            <Card key={exercise.id}>
                                                <Card.Content className="px-4 py-3 flex flex-col gap-3">
                                                    {/* Exercise header */}
                                                    <div className="flex items-start gap-3">
                                                        {/* Thumbnail */}
                                                        <div className="relative w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-muted-foreground/40 overflow-hidden">
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                            </svg>
                                                            {exercise.thumbnail_path && (
                                                                <img
                                                                    src={exercise.thumbnail_path}
                                                                    alt={exercise.name}
                                                                    className="absolute inset-0 w-full h-full object-cover"
                                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-xs font-bold text-primary">#{exIdx + 1}</span>
                                                                <span className="font-semibold text-sm text-foreground">{exercise.name}</span>
                                                                {(exercise.youtube_url || exercise.video_path) && (
                                                                    <button
                                                                        onClick={() => setVideoOpenId(videoOpenId === exercise.id ? null : exercise.id)}
                                                                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer ${
                                                                            videoOpenId === exercise.id
                                                                                ? "bg-primary border-primary text-primary-foreground"
                                                                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                                                                        }`}
                                                                    >
                                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                                            <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                                        </svg>
                                                                        {videoOpenId === exercise.id ? t('hideVideo') : t('watchVideo')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                {exercise.muscle_group && (
                                                                    <Chip size="sm" className="bg-secondary text-foreground">{exercise.muscle_group}</Chip>
                                                                )}
                                                                {exercise.equipment && (
                                                                    <Chip size="sm" className="bg-violet-500/15 text-violet-600">{exercise.equipment}</Chip>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Inline video */}
                                                    {videoOpenId === exercise.id && (exercise.youtube_url || exercise.video_path) && (
                                                        <div className="rounded-xl overflow-hidden bg-black aspect-video">
                                                            {getYoutubeEmbedUrl(exercise.youtube_url) ? (
                                                                <iframe
                                                                    src={getYoutubeEmbedUrl(exercise.youtube_url)}
                                                                    className="w-full h-full"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                />
                                                            ) : (
                                                                <video src={`${process.env.NEXT_PUBLIC_API_URL}${exercise.video_path}`} controls className="w-full h-full" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {exercise.notes && (
                                                        <p className="text-xs text-muted-foreground italic">{exercise.notes}</p>
                                                    )}

                                                    {getLocalizedField(exercise, 'instructions', locale) && (
                                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{getLocalizedField(exercise, 'instructions', locale)}</p>
                                                    )}

                                                    {/* Sets */}
                                                    {(exercise.sets ?? []).length > 0 && (
                                                        <div>
                                                            <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">
                                                                <span>{t('set')}</span>
                                                                <span>{t('reps')}</span>
                                                                <span>{t('rest')}</span>
                                                                <span>{t('tempo')}</span>
                                                                <span>{t('rir')}</span>
                                                            </div>
                                                            <div className="flex flex-col divide-y divide-border">
                                                                {exercise.sets.map((set, sIdx) => (
                                                                    <div key={set.id} className="grid grid-cols-5 gap-2 py-1.5 text-sm text-foreground">
                                                                        <span className="text-muted-foreground text-xs">{sIdx + 1}</span>
                                                                        <span>{set.reps || "—"}</span>
                                                                        <span>{set.rest_seconds != null ? `${set.rest_seconds}s` : "—"}</span>
                                                                        <span>{set.tempo || "—"}</span>
                                                                        <span>{set.rir != null ? set.rir : "—"}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Alternatives */}
                                                    {(exercise.alternatives ?? []).length > 0 && (
                                                        <div className="ps-3 border-s-2 border-border">
                                                            <span className="text-[10px] text-muted-foreground/50 mb-1 block">{t('alternatives')}</span>
                                                            <div className="flex flex-col gap-1.5">
                                                                {exercise.alternatives.map(alt => (
                                                                    <div key={alt.id} className="flex items-center gap-2">
                                                                        {alt.thumbnail_path && (
                                                                            <img
                                                                                src={alt.thumbnail_path}
                                                                                alt={getLocalizedField(alt, 'name', locale)}
                                                                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                            />
                                                                        )}
                                                                        <span className="text-xs font-medium text-foreground">{getLocalizedField(alt, 'name', locale)}</span>
                                                                        {alt.muscle_group && <span className="text-[11px] text-muted-foreground">{alt.muscle_group}</span>}
                                                                        {alt.equipment && <span className="text-[11px] text-muted-foreground ms-auto">{alt.equipment}</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Card.Content>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
