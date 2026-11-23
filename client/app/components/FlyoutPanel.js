'use client';

import { useLayoutEffect, useRef } from 'react';

// Breathing room kept between the panel and the screen edge.
const EDGE_MARGIN_PX = 8;

// The second level of a filter menu: a panel that opens beside the menu row it belongs to.
//
// By default it opens toward the end side (right in English, left in Arabic). Filter menus usually sit
// at the end edge of a toolbar, so there often is no room there — the panel is measured as soon as it
// appears and, if it would run off the screen, it opens on the other side instead. If neither side has
// room (a narrow screen) it drops underneath the row at full width. A panel taller than the space below
// is nudged up so it stays on screen.
//
// Pass the look (background, border, padding, z-index) as `className`. A caller that wants its own
// layout at some size can set `static` there (e.g. `max-sm:static`); the panel then leaves it alone.
export default function FlyoutPanel({ className = '', children }) {
    const panelRef = useRef(null);

    // Direct DOM changes, not state: this runs before the browser paints, so the panel never shows
    // in the wrong place first.
    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!panel || getComputedStyle(panel).position !== 'absolute') return;

        const spillsSideways = () => {
            const box = panel.getBoundingClientRect();
            return box.left < 0 || box.right > window.innerWidth;
        };

        if (spillsSideways()) {
            panel.style.insetInlineStart = 'auto';
            panel.style.insetInlineEnd = '100%';
            panel.style.marginInlineStart = '0';
            panel.style.marginInlineEnd = '0.25rem';

            if (spillsSideways()) {
                // Neither side fits: stack under the row instead.
                panel.style.position = 'static';
                panel.style.width = '100%';
                panel.style.marginInlineEnd = '0';
                panel.style.marginTop = '0.5rem';
                return;
            }
        }

        const box = panel.getBoundingClientRect();
        const overflowBelow = box.bottom - (window.innerHeight - EDGE_MARGIN_PX);
        if (overflowBelow > 0) {
            // Never lift it above the top of the screen.
            panel.style.transform = `translateY(-${Math.min(overflowBelow, Math.max(0, box.top - EDGE_MARGIN_PX))}px)`;
        }
    }, []);

    return (
        <div ref={panelRef} className={`absolute top-0 start-full ms-1 ${className}`}>
            {children}
        </div>
    );
}
