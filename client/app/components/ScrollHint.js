'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';

// Browsers differ by a pixel or two at the ends of a scroll range.
const EDGE_TOLERANCE_PX = 2;

// A sideways-scrolling strip (tab bars) that tells people there is more: a soft fade with a small
// arrow appears on each side that has hidden content, and goes away once they reach that end.
// Direction-aware, so in Arabic the "start" of the strip is on the right.
export default function ScrollHint({ children, className = '' }) {
    const scrollerRef = useRef(null);
    const isRtl = useLocale() === 'ar';
    const [hasMore, setHasMore] = useState({ start: false, end: false });

    const measure = useCallback(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        // scrollLeft is negative in right-to-left layouts; only the distance from the start matters.
        const distanceFromStart = Math.abs(scroller.scrollLeft);
        setHasMore({
            start: distanceFromStart > EDGE_TOLERANCE_PX,
            end: maxScroll - distanceFromStart > EDGE_TOLERANCE_PX,
        });
    }, []);

    // The observer reports once when it starts watching, then on every size change.
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const observer = new ResizeObserver(measure);
        observer.observe(scroller);
        if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
        return () => observer.disconnect();
    }, [measure]);

    return (
        <div className={`relative min-w-0 ${className}`}>
            <div ref={scrollerRef} onScroll={measure} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {children}
            </div>
            {hasMore.start && <Edge side={isRtl ? 'right' : 'left'} />}
            {hasMore.end && <Edge side={isRtl ? 'left' : 'right'} />}
        </div>
    );
}

// Fade + arrow pointing toward the hidden content on that physical side.
function Edge({ side }) {
    const isLeft = side === 'left';
    const Arrow = isLeft ? ChevronLeft : ChevronRight;
    return (
        <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 flex w-9 items-center ${isLeft ? 'left-0 justify-start' : 'right-0 justify-end'}`}
            style={{ background: `linear-gradient(to ${isLeft ? 'right' : 'left'}, var(--background), transparent)` }}
        >
            <Arrow size={16} className="animate-pulse text-muted-foreground" />
        </div>
    );
}
