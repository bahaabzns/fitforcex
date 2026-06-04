"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";

const SERVER = "http://localhost:4000";

function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default function ClientTrainingPage() {
    const t = useTranslations('portal.training');
    const locale = useLocale();
    const [trainingPlan, setTrainingPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [noplan, setNoPlan] = useState(false);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [videoOpenId, setVideoOpenId] = useState(null);
    const router = useRouter();

    useEffect(() => {
        api.get("/api/client-portal/active-training-plan")
            .then((res) => setTrainingPlan(res.data))
            .catch((e) => {
                if (e.response?.status === 404) setNoPlan(true);
                else {
                    const slug = localStorage.getItem('portal_slug');
                    router.push(slug ? `/portal/${slug}` : '/portal');
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
            </div>
        );
    }

    if (noplan || !trainingPlan) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold text-foreground mb-6">{t('title')}</h1>
                <Card>
                    <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        <p className="text-base font-medium text-muted-foreground">{t('noActivePlan')}</p>
                        <p className="text-sm text-muted-foreground/70">{t('noActivePlanHint')}</p>
                    </Card.Content>
                </Card>
            </div>
        );
    }

    const activeDay = (trainingPlan.days ?? [])[activeDayIndex] ?? null;

    return (
        <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
            {/* Plan header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            </div>

            <Card>
                <Card.Content className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">{t('activePlan')}</p>
                        <h2 className="text-lg font-bold text-foreground">{trainingPlan.name}</h2>
                    </div>
                    <Chip size="sm" className="bg-green-500/15 text-green-700">{t('active')}</Chip>
                </Card.Content>
            </Card>

            {/* Plan notes */}
            {trainingPlan.notes && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-6">
                    <p className="text-xs font-semibold text-yellow-600 mb-1">{t('coachNote')}</p>
                    <p className="text-sm text-yellow-600 whitespace-pre-wrap">{trainingPlan.notes}</p>
                </div>
            )}

            {/* Day tabs */}
            {(trainingPlan.days ?? []).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {(trainingPlan.days ?? []).map((day, i) => (
                        <button
                            key={day.id}
                            onClick={() => { setActiveDayIndex(i); setVideoOpenId(null); }}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                activeDayIndex === i
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:bg-default"
                            }`}
                        >
                            {day.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Active day content */}
            {activeDay && (
                <div className="flex flex-col gap-4">
                    {/* Day notes */}
                    {activeDay.notes && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
                            <p className="text-xs font-semibold text-primary mb-1">{t('dayNote')}</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{activeDay.notes}</p>
                        </div>
                    )}

                    {(activeDay.exercises ?? []).length === 0 ? (
                        <Card>
                            <Card.Content className="p-6 text-center py-8 text-sm text-muted-foreground">
                                {t('noExercises')}
                            </Card.Content>
                        </Card>
                    ) : (
                        (activeDay.exercises ?? []).map((exercise, exIdx) => (
                            <Card key={exercise.id}>
                                <Card.Content className="p-6 flex flex-col gap-3">
                                    {/* Exercise header */}
                                    <div className="flex items-start gap-3">
                                        {/* Thumbnail */}
                                        {exercise.thumbnail_path ? (
                                            <img
                                                src={`${SERVER}${exercise.thumbnail_path}`}
                                                alt={exercise.name}
                                                className="w-16 h-16 rounded-lg object-cover shrink-0"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-muted-foreground/40">
                                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                </svg>
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-primary">#{exIdx + 1}</span>
                                                <h4 className="font-semibold text-foreground">{exercise.name}</h4>
                                                {(exercise.youtube_url || exercise.video_path) && (
                                                    <button
                                                        onClick={() => setVideoOpenId(videoOpenId === exercise.id ? null : exercise.id)}
                                                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer ${
                                                            videoOpenId === exercise.id
                                                                ? "bg-primary border-primary text-primary-foreground"
                                                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                                                        }`}
                                                    >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                        </svg>
                                                        {videoOpenId === exercise.id ? t('hideVideo') : t('watchVideo')}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                                        <div className="rounded-lg overflow-hidden bg-black aspect-video">
                                            {getYoutubeEmbedUrl(exercise.youtube_url) ? (
                                                <iframe
                                                    src={getYoutubeEmbedUrl(exercise.youtube_url)}
                                                    className="w-full h-full"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            ) : (
                                                <video src={`${SERVER}${exercise.video_path}`} controls className="w-full h-full" />
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
                                            <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
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
                                        <div className="pl-3 border-l-2 border-border">
                                            <p className="text-xs text-muted-foreground mb-1.5">{t('alternatives')}</p>
                                            <div className="flex flex-col gap-1">
                                                {exercise.alternatives.map((alt) => (
                                                    <div key={alt.id} className="flex items-center gap-2">
                                                        {alt.thumbnail_path && (
                                                            <img src={`${SERVER}${alt.thumbnail_path}`} alt={getLocalizedField(alt, 'name', locale)} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                                        )}
                                                        <span className="text-xs font-medium text-foreground">{getLocalizedField(alt, 'name', locale)}</span>
                                                        {alt.muscle_group && <span className="text-xs text-muted-foreground">{alt.muscle_group}</span>}
                                                        {alt.equipment && <span className="text-xs text-muted-foreground ml-auto">{alt.equipment}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
