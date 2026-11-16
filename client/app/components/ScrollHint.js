'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';

// Browsers differ by a pixel or two at the ends of a scroll range.
const EDGE_TOLERANCE_PX = 2;

// How far in from an edge the tabs fade out.
const FADE_WIDTH_PX = 28;

const NOTHING_HIDDEN = { overflowing: false, start: false, end: false };

// A sideways-scrolling strip (tab bars) that tells people there is more. When the content does not
// fit, a small arrow slot appears on each side — outside the strip, so it never covers a label —
// and its arrow shows while that side still has hidden content. Direction-aware: in Arabic the
// start of the strip is on the right.
//
// The scroll shadow is a mask on the strip itself: at each edge that has more to scroll to, the tabs
// fade to transparent, so it works on any background with no colour to match.
export default function ScrollHint({ children, className = '' }) {
    const outerRef = useRef(null);
    const scrollerRef = useRef(null);
    const isRtl = useLocale() === 'ar';
    const [hint, setHint] = useState(NOTHING_HIDDEN);

    const measure = useCallback(() => {
        const outer = outerRef.current;
        const scroller = scrollerRef.current;
        if (!outer || !scroller) return;

        // Judged against the outer box (not the scroller) so adding the slots cannot flip the answer.
        // scrollWidth counts content that spills out of a wrapper that is itself only as wide as the bar.
        const overflowing = scroller.scrollWidth > outer.clientWidth + EDGE_TOLERANCE_PX;

        // scrollLeft is negative in right-to-left layouts; only the distance from the start matters.
        const distanceFromStart = Math.abs(scroller.scrollLeft);
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        const next = {
            overflowing,
            start: overflowing && distanceFromStart > EDGE_TOLERANCE_PX,
            end: overflowing && maxScroll - distanceFromStart > EDGE_TOLERANCE_PX,
        };
        setHint(prev => (prev.overflowing === next.overflowing && prev.start === next.start && prev.end === next.end ? prev : next));
    }, []);

    // The observer reports once when it starts watching, then on every size change.
    useEffect(() => {
        const outer = outerRef.current;
        const scroller = scrollerRef.current;
        if (!outer || !scroller) return;
        const observer = new ResizeObserver(measure);
        observer.observe(outer);
        observer.observe(scroller);
        // The tab list can be wider than its wrapper, so watch the first two levels of content.
        const wrapper = scroller.firstElementChild;
        if (wrapper) {
            observer.observe(wrapper);
            if (wrapper.firstElementChild) observer.observe(wrapper.firstElementChild);
        }
        return () => observer.disconnect();
    }, [measure]);

    // Physical sides: the start of the strip is on the right in Arabic.
    const fadeLeft = isRtl ? hint.end : hint.start;
    const fadeRight = isRtl ? hint.start : hint.end;
    const mask = `linear-gradient(to right, transparent 0, #000 ${fadeLeft ? FADE_WIDTH_PX : 0}px, #000 calc(100% - ${fadeRight ? FADE_WIDTH_PX : 0}px), transparent 100%)`;

    const StartArrow = isRtl ? ChevronRight : ChevronLeft;
    const EndArrow = isRtl ? ChevronLeft : ChevronRight;

    return (
        <div ref={outerRef} className={`flex min-w-0 items-center ${className}`}>
            {hint.overflowing && <ArrowSlot visible={hint.start} Arrow={StartArrow} />}
            <div
                ref={scrollerRef}
                onScroll={measure}
                className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ maskImage: mask, WebkitMaskImage: mask }}
            >
                {children}
            </div>
            {hint.overflowing && <ArrowSlot visible={hint.end} Arrow={EndArrow} />}
        </div>
    );
}

// The slot keeps its width while overflowing, so the strip never jumps as the arrow comes and goes.
function ArrowSlot({ visible, Arrow }) {
    return (
        <span aria-hidden="true" className="flex w-5 shrink-0 items-center justify-center text-muted-foreground" style={{ opacity: visible ? 1 : 0 }}>
            <Arrow size={16} className={visible ? 'animate-pulse' : undefined} />
        </span>
    );
}
