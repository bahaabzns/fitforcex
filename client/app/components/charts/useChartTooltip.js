'use client';

import { useCallback, useRef, useState } from 'react';

const TOOLTIP_OFFSET = 14;
const TOOLTIP_ESTIMATED_WIDTH = 220;

// One tooltip per chart. `bind(content)` returns the pointer/focus props for a mark; the tooltip
// itself is rendered by <ChartTooltip /> inside the same position:relative wrapper.
export function useChartTooltip() {
    const wrapperRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);

    const showAt = useCallback((clientX, clientY, content) => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const x = clientX - rect.left;
        // Flip to the left of the pointer when there is no room on the right.
        const flipLeft = x + TOOLTIP_OFFSET + TOOLTIP_ESTIMATED_WIDTH > rect.width;
        setTooltip({ x: flipLeft ? Math.max(0, x - TOOLTIP_OFFSET - TOOLTIP_ESTIMATED_WIDTH) : x + TOOLTIP_OFFSET, y: clientY - rect.top + TOOLTIP_OFFSET, content });
    }, []);

    const hide = useCallback(() => setTooltip(null), []);

    const bind = useCallback((content) => ({
        onPointerMove: (event) => showAt(event.clientX, event.clientY, content),
        onPointerLeave: hide,
        onFocus: (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            showAt(rect.left + rect.width / 2, rect.top, content);
        },
        onBlur: hide,
    }), [showAt, hide]);

    return { wrapperRef, tooltip, bind, showAt, hide };
}
