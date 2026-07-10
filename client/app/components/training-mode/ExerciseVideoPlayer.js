"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { getYoutubeEmbedUrl } from "@/utils/video";

const DumbbellIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />
    </svg>
);

// Full-width 16:9 exercise video. Shows a thumbnail with a play overlay until
// clicked, so the embed (YouTube iframe or uploaded file) only loads on demand.
export default function ExerciseVideoPlayer({ youtubeUrl, videoPath, thumbnailPath, name, watchLabel }) {
    const [playing, setPlaying] = useState(false);

    const embedUrl = getYoutubeEmbedUrl(youtubeUrl);
    const hasVideo = Boolean(embedUrl || videoPath);

    if (!hasVideo && !thumbnailPath) return null;

    return (
        <div className="relative w-full aspect-video bg-black overflow-hidden">
            {playing && hasVideo ? (
                embedUrl ? (
                    <iframe
                        src={`${embedUrl}?autoplay=1`}
                        title={name}
                        loading="lazy"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <video
                        src={`${process.env.NEXT_PUBLIC_API_URL}${videoPath}`}
                        controls
                        autoPlay
                        className="w-full h-full"
                    />
                )
            ) : (
                <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    disabled={!hasVideo}
                    aria-label={watchLabel}
                    className={`group absolute inset-0 w-full h-full ${hasVideo ? "cursor-pointer" : "cursor-default"}`}
                >
                    {thumbnailPath ? (
                        <img
                            src={thumbnailPath}
                            alt={name}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-app-surface-card text-muted-foreground/40">
                            <DumbbellIcon />
                        </div>
                    )}
                    {hasVideo && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-white/90 text-black shadow-lg">
                                <Play className="w-6 h-6 ms-1" fill="currentColor" />
                            </span>
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
