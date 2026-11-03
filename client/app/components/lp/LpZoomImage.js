'use client';

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Maximize2 } from "lucide-react";
import { LANDING_SHOTS, shotSrc } from "@/lib/landingConfig";
import { useLpLightbox } from "./LpLightbox";

const EDGE_PERCENT = 22;

// Where a marker's label opens so it never leaves the frame.
function labelSide(x, y) {
    const horizontal = x < EDGE_PERCENT ? "start" : x > 100 - EDGE_PERCENT ? "end" : "center";
    return `is-${horizontal} ${y < 50 ? "is-below" : "is-above"}`;
}

// One screenshot, zoomed into the important part. The image layer always covers its frame, so
// markers sit in image coordinates and zoom with it; mini cards sit in frame coordinates.
export default function LpZoomImage({ shotId, alt, view = "default", markerLimit, priority = false, className = "" }) {
    const shot = LANDING_SHOTS[shotId];
    const locale = useLocale();
    const t = useTranslations(`lp.shots.${shotId}`);
    const tUi = useTranslations("lp.ui");
    const openLightbox = useLpLightbox();
    const [activeMarker, setActiveMarker] = useState(null);

    const flip = locale === "ar" && shot.mirror !== false;
    const x = (value) => (flip ? 100 - value : value);
    const focusSource = view === "tool" && shot.toolFocus ? shot.toolFocus : shot.focus;
    const focus = { x: x(focusSource.x), y: focusSource.y, zoom: focusSource.zoom };
    const src = shotSrc(shot, locale);

    const markerLabels = t.raw("markers");
    const cardLabels = t.raw("cards");
    // Bento crops show a single marker, picked so it is always inside the zoomed crop.
    const visibleMarkers = view === "tool"
        ? [shot.toolMarker ?? 0]
        : shot.markers.map((_, index) => index).slice(0, markerLimit ?? shot.markers.length);

    function open() {
        openLightbox({ src, alt, w: shot.w, h: shot.h });
    }

    return (
        <div
            className={`lp-zoom ${className}`}
            onClick={open}
            onPointerLeave={() => setActiveMarker(null)}
        >
            <div
                className="lp-zoom__layer"
                style={{
                    "--ar": shot.w / shot.h,
                    "--z": focus.zoom,
                    "--tx": `${50 - focus.x}%`,
                    "--ty": `${50 - focus.y}%`,
                }}
            >
                <Image src={src} alt={alt} fill sizes="(min-width: 1000px) 700px, 100vw" unoptimized priority={priority} />
                {visibleMarkers.map((index) => {
                    const marker = shot.markers[index];
                    return (
                    <button
                        key={index}
                        type="button"
                        className={`lp-marker ${labelSide(x(marker.x), marker.y)} ${activeMarker === index ? "is-open" : ""}`}
                        style={{ left: `${x(marker.x)}%`, top: `${marker.y}%` }}
                        aria-label={markerLabels[index]}
                        aria-expanded={activeMarker === index}
                        onClick={(event) => { event.stopPropagation(); setActiveMarker(activeMarker === index ? null : index); }}
                    >
                        <span className="lp-marker__dot" aria-hidden="true" />
                        <span className="lp-marker__label" role="tooltip">{markerLabels[index]}</span>
                    </button>
                    );
                })}
            </div>

            {shot.cards.map((card, index) => (
                <div key={index} className="lp-mini" style={{ left: `${x(card.x)}%`, top: `${card.y}%` }} aria-hidden="true">
                    <span>{cardLabels[index]?.label}</span>
                    <strong>{cardLabels[index]?.value}</strong>
                </div>
            ))}

            <button type="button" className="lp-expand" onClick={(event) => { event.stopPropagation(); open(); }} aria-label={`${tUi("open")}: ${alt}`}>
                <Maximize2 size={16} aria-hidden="true" />
            </button>
        </div>
    );
}
