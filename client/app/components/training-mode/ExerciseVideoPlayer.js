"use client";

import { useEffect, useRef, useState } from "react";
import { Play, ExternalLink } from "lucide-react";
import { getYoutubeVideoId } from "@/utils/video";

const DumbbellIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />
    </svg>
);

// Loads the YouTube IFrame Player API once and shares the same promise across
// every ExerciseVideoPlayer instance on the page (a session can list many).
let youtubeApiPromise = null;
function loadYoutubeIframeApi() {
    if (typeof window === "undefined") return Promise.resolve(null);
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!youtubeApiPromise) {
        youtubeApiPromise = new Promise((resolve) => {
            const previousCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                previousCallback?.();
                resolve(window.YT);
            };
            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const script = document.createElement("script");
                script.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(script);
            }
        });
    }
    return youtubeApiPromise;
}

// Full-width 16:9 exercise video. Shows a thumbnail with a play overlay until
// clicked, so the embed (YouTube iframe or uploaded file) only loads on demand.
//
// YouTube videos load through the real IFrame Player API (not a plain <iframe
// src>) because a plain iframe can't report playback failures to the parent
// page — some Shorts/videos fail to embed (owner restrictions, region locks,
// etc.) and a raw iframe would just show YouTube's own dead-end error screen
// forever. The API's onError event lets us swap in a "Watch on YouTube" link.
export default function ExerciseVideoPlayer({ youtubeUrl, videoPath, thumbnailPath, name, watchLabel, watchOnYoutubeLabel }) {
    const [playing, setPlaying] = useState(false);
    const [youtubeError, setYoutubeError] = useState(false);
    const playerHostRef = useRef(null);
    const playerRef = useRef(null);

    const videoId = getYoutubeVideoId(youtubeUrl);
    const hasVideo = Boolean(videoId || videoPath);

    useEffect(() => {
        if (!playing || !videoId || youtubeError) return;
        let cancelled = false;

        loadYoutubeIframeApi().then((YT) => {
            if (cancelled || !YT || !playerHostRef.current) return;
            playerRef.current = new YT.Player(playerHostRef.current, {
                videoId,
                width: "100%",
                height: "100%",
                playerVars: { autoplay: 1 },
                events: {
                    onError: () => setYoutubeError(true),
                },
            });
        });

        return () => {
            cancelled = true;
            playerRef.current?.destroy?.();
            playerRef.current = null;
        };
    }, [playing, videoId, youtubeError]);

    if (!hasVideo && !thumbnailPath) return null;

    return (
        <div className="relative w-full aspect-video bg-black overflow-hidden">
            {playing && hasVideo ? (
                videoId ? (
                    youtubeError ? (
                        <a
                            href={youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90 hover:text-white bg-app-surface-card transition-colors"
                        >
                            <ExternalLink className="w-7 h-7" />
                            <span className="text-sm font-medium">{watchOnYoutubeLabel}</span>
                        </a>
                    ) : (
                        <div ref={playerHostRef} className="absolute inset-0 w-full h-full" />
                    )
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
