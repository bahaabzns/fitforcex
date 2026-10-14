"use client";

import { useRef, useState } from "react";

const DRAG_INTENT_PX = 10;
const DRAG_HORIZONTAL_BIAS = 1.2;
const COMMIT_FRACTION = 0.25;
// Space between neighbouring panels in the track (also the track step offset).
const PANEL_GAP_PX = 12;
const SLIDE_TRANSITION = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";

// True when the touch began inside something that scrolls sideways or takes
// text input, so a swipe there is the user's scroll/selection, not navigation.
function startsInsideHorizontalScroller(target, boundary) {
    for (let el = target; el && el !== boundary; el = el.parentElement) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return true;
        if (el.scrollWidth > el.clientWidth + 1) {
            const overflowX = getComputedStyle(el).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") return true;
        }
    }
    return false;
}

/**
 * One-panel-per-screen navigation for the builder pages on phones, animated
 * like a story reel: the panels sit side by side in a track that follows the
 * finger while dragging and slides to the target panel on release.
 * `maxStep` is the deepest panel that currently has something to show
 * (0 = plans list, 1 = plan detail, 2 = meal/day detail). Selections are kept
 * when swiping back, so swiping forward returns to where you were.
 *
 * Apply `panelStyle` to every panel (each `w-full shrink-0`) and spread
 * `swipeHandlers` on their shared overflow-hidden container.
 */
export function useMobilePanels({ isMobile, maxStep }) {
    const [step, setStep] = useState(0);
    const [dragPx, setDragPx] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [previousMaxStep, setPreviousMaxStep] = useState(maxStep);
    const touch = useRef(null);

    // Selecting something deeper moves the view to it; clearing it clamps back.
    // Adjusted during render (not in an effect) so there is no stale-frame flash.
    if (maxStep !== previousMaxStep) {
        setPreviousMaxStep(maxStep);
        if (maxStep > previousMaxStep) setStep(maxStep);
        else if (step > maxStep) setStep(maxStep);
    }

    const currentStep = Math.min(step, maxStep);
    // Panels are laid out in reading order, so the track moves the other way in RTL.
    const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const trackDirection = isRtl ? 1 : -1;

    // Logical drag: positive = toward the previous panel, negative = toward the next.
    function clampDrag(logicalPx, width) {
        const maxBack = currentStep > 0 ? width : 0;
        const maxForward = currentStep < maxStep ? width : 0;
        return Math.max(-maxForward, Math.min(maxBack, logicalPx));
    }

    function handleTouchStart(e) {
        const point = e.touches[0];
        touch.current = startsInsideHorizontalScroller(e.target, e.currentTarget)
            ? null
            : { x: point.clientX, y: point.clientY, width: e.currentTarget.clientWidth + PANEL_GAP_PX, intent: null };
    }

    function handleTouchMove(e) {
        const t = touch.current;
        if (!t) return;
        const point = e.touches[0];
        const deltaX = point.clientX - t.x;
        const deltaY = point.clientY - t.y;
        if (!t.intent) {
            if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DRAG_INTENT_PX) return;
            t.intent = Math.abs(deltaX) > Math.abs(deltaY) * DRAG_HORIZONTAL_BIAS ? "x" : "y";
            if (t.intent === "x") setIsDragging(true);
        }
        if (t.intent !== "x") return;
        setDragPx(clampDrag(-trackDirection * deltaX, t.width));
    }

    function handleTouchEnd() {
        const t = touch.current;
        touch.current = null;
        if (!t || t.intent !== "x") return;
        const travelled = dragPx;
        setIsDragging(false);
        setDragPx(0);
        if (Math.abs(travelled) < t.width * COMMIT_FRACTION) return;
        setStep(currentStep + (travelled > 0 ? -1 : 1));
    }

    if (!isMobile) {
        return { step: currentStep, goToStep: setStep, swipeHandlers: {}, panelStyle: undefined };
    }

    return {
        step: currentStep,
        goToStep: setStep,
        swipeHandlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd,
            // Let the browser own vertical scrolling; horizontal belongs to the track.
            style: { touchAction: "pan-y", columnGap: PANEL_GAP_PX },
        },
        panelStyle: {
            // dragPx is logical (positive = back); convert to a physical offset.
            transform: `translateX(calc(${trackDirection * currentStep} * (100% + ${PANEL_GAP_PX}px) + ${-trackDirection * dragPx}px))`,
            transition: isDragging ? "none" : SLIDE_TRANSITION,
        },
    };
}
