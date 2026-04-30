"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

const SERVER = "http://localhost:4000";

function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default function ClientTrainingPage() {
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
                else router.push("/client/login");
            })
            .finally(() => setLoading(false));
    }, [router]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <p className="text-gray-500">Loading…</p>
            </div>
        );
    }

    if (noplan || !trainingPlan) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Training Plan</h1>
                <div className="card flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <svg className="w-12 h-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    <p className="text-base font-medium text-gray-600">No active training plan yet</p>
                    <p className="text-sm text-gray-400">Your coach hasn&apos;t activated a training plan for you yet.</p>
                </div>
            </div>
        );
    }

    const activeDay = (trainingPlan.days ?? [])[activeDayIndex] ?? null;

    return (
        <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
            {/* Plan header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Training Plan</h1>
            </div>

            <div className="card flex items-center justify-between">
                <div>
                    <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Active Training Plan</p>
                    <h2 className="text-lg font-bold text-gray-900">{trainingPlan.name}</h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">Active</span>
            </div>

            {/* Plan notes */}
            {trainingPlan.notes && (
                <div className="card bg-yellow-50 border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">Coach Note</p>
                    <p className="text-sm text-yellow-800 whitespace-pre-wrap">{trainingPlan.notes}</p>
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
                                    ? "bg-blue-500 border-blue-500 text-white"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
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
                        <div className="card bg-blue-50 border border-blue-200">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Day Note</p>
                            <p className="text-sm text-blue-800 whitespace-pre-wrap">{activeDay.notes}</p>
                        </div>
                    )}

                    {(activeDay.exercises ?? []).length === 0 ? (
                        <div className="card text-center py-8 text-sm text-gray-400">No exercises for this day.</div>
                    ) : (
                        (activeDay.exercises ?? []).map((exercise, exIdx) => (
                            <div key={exercise.id} className="card flex flex-col gap-3">
                                {/* Exercise header */}
                                <div className="flex items-start gap-3">
                                    {/* Thumbnail */}
                                    {exercise.thumbnail_path ? (
                                        <img
                                            src={`${SERVER}${exercise.thumbnail_path}`}
                                            alt={exercise.name}
                                            className="w-16 h-16 rounded-xl object-cover shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-gray-300">
                                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                            </svg>
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-blue-600">#{exIdx + 1}</span>
                                            <h4 className="font-semibold text-gray-900">{exercise.name}</h4>
                                            {(exercise.youtube_url || exercise.video_path) && (
                                                <button
                                                    onClick={() => setVideoOpenId(videoOpenId === exercise.id ? null : exercise.id)}
                                                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer ${
                                                        videoOpenId === exercise.id
                                                            ? "bg-blue-500 border-blue-500 text-white"
                                                            : "border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500"
                                                    }`}
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                                                    </svg>
                                                    {videoOpenId === exercise.id ? "Hide" : "Watch"}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {exercise.muscle_group && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{exercise.muscle_group}</span>
                                            )}
                                            {exercise.equipment && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{exercise.equipment}</span>
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
                                            <video src={`${SERVER}${exercise.video_path}`} controls className="w-full h-full" />
                                        )}
                                    </div>
                                )}

                                {/* Notes */}
                                {exercise.notes && (
                                    <p className="text-xs text-gray-500 italic">{exercise.notes}</p>
                                )}

                                {/* Instructions */}
                                {exercise.instructions && (
                                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{exercise.instructions}</p>
                                )}

                                {/* Sets */}
                                {(exercise.sets ?? []).length > 0 && (
                                    <div>
                                        <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                            <span>Set</span>
                                            <span>Reps</span>
                                            <span>Rest</span>
                                            <span>Tempo</span>
                                            <span>RIR</span>
                                        </div>
                                        <div className="flex flex-col divide-y divide-gray-100">
                                            {exercise.sets.map((set, sIdx) => (
                                                <div key={set.id} className="grid grid-cols-5 gap-2 py-1.5 text-sm text-gray-700">
                                                    <span className="text-gray-400 text-xs">{sIdx + 1}</span>
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
                                    <div className="pl-3 border-l-2 border-gray-200">
                                        <p className="text-xs text-gray-400 mb-1.5">Alternatives:</p>
                                        <div className="flex flex-col gap-1">
                                            {exercise.alternatives.map((alt) => (
                                                <div key={alt.id} className="flex items-center gap-2">
                                                    {alt.thumbnail_path && (
                                                        <img src={`${SERVER}${alt.thumbnail_path}`} alt={alt.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                                    )}
                                                    <span className="text-xs font-medium text-gray-700">{alt.name}</span>
                                                    {alt.muscle_group && <span className="text-xs text-gray-400">{alt.muscle_group}</span>}
                                                    {alt.equipment && <span className="text-xs text-gray-400 ml-auto">{alt.equipment}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
