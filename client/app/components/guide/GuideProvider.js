'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from "lucide-react";
import { guideTargets, STOP_WHEN_DONE } from "@/app/components/guide/guideSteps";
import { useGettingStartedContext } from "@/app/components/gettingStarted/GettingStartedProvider";

const GuideContext = createContext({ startGuide: () => {}, stopGuide: () => {} });
export const useGuide = () => useContext(GuideContext);

const POLL_MS = 250;
// A page change briefly removes the targets; keep the arrow where it was instead of flickering away and back.
const LOST_TARGET_GRACE_MS = 700;
const BUBBLE_WIDTH = 240;
const VIEWPORT_MARGIN = 8;
const RING_PADDING = 6;
const ARROW_SIZE = 28;
// A target closer than this to a screen edge is treated as hugging it (the sidebar).
const EDGE_HUG_PX = 80;
const BUBBLE_HEIGHT_ESTIMATE = 96;
const MOVE_TRANSITION = 'top 320ms ease, left 320ms ease, width 320ms ease, height 320ms ease, transform 320ms ease';

function isUsable(element) {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.right < 0 || rect.left > window.innerWidth) return false;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Off-screen vertically: it exists, so scroll to it first. On screen: it must actually be what is painted there
    // (a collapsed menu or a hidden tab keeps its elements in the page but you cannot see or click them).
    if (centerY < 0 || centerY > window.innerHeight || centerX < 0 || centerX > window.innerWidth) return true;
    const hit = document.elementFromPoint(centerX, centerY);
    return !!hit && (element === hit || element.contains(hit) || hit.contains(element));
}

function findTarget(targets) {
    const isPhone = window.innerWidth < 1024;
    for (let index = 0; index < targets.length; index += 1) {
        // The menu button is only a way to reach targets inside the slide-over menu, which only exists on small screens.
        if (targets[index].phoneOnly && !isPhone) continue;
        if (targets[index].skipOnPath && window.location.pathname.startsWith(targets[index].skipOnPath)) continue;
        for (const element of document.querySelectorAll(targets[index].selector)) {
            // A field target ("write the package name") only counts while that field is still empty.
            if (targets[index].whenEmpty) {
                const input = element.matches('input, textarea') ? element : element.querySelector('input, textarea');
                if (!input || input.value !== '') continue;
            }
            if (isUsable(element)) return { index, element, target: targets[index] };
        }
    }
    return null;
}

function GuideOverlay({ guide, onClose }) {
    const t = useTranslations('guide');
    const { status, refresh } = useGettingStartedContext();
    const targets = useMemo(() => guideTargets(guide), [guide]);

    // Steps that finish with something the server can see close the guide the moment they are done.
    const stepDone = STOP_WHEN_DONE.has(guide.key) && !!status?.steps?.some(step => step.key === guide.key && step.done);
    useEffect(() => { if (stepDone) onClose(); }, [stepDone, onClose]);
    const [spot, setSpot] = useState(null);
    const current = useRef(null);
    const lastKey = useRef('');
    const lostTimer = useRef(null);

    useEffect(() => {
        function update() {
            const found = findTarget(targets);
            current.current = found;
            if (!found) {
                if (lastKey.current !== '' && !lostTimer.current) {
                    lostTimer.current = setTimeout(() => { lastKey.current = ''; lostTimer.current = null; setSpot(null); }, LOST_TARGET_GRACE_MS);
                }
                return;
            }
            if (lostTimer.current) { clearTimeout(lostTimer.current); lostTimer.current = null; }
            const rect = found.element.getBoundingClientRect();
            const offScreen = rect.top < 0 || rect.bottom > window.innerHeight;
            const key = `${found.index}|${Math.round(rect.top)}|${Math.round(rect.left)}|${Math.round(rect.width)}|${Math.round(rect.height)}`;
            if (key === lastKey.current) return;
            lastKey.current = key;
            if (offScreen) found.element.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setSpot({ rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, label: found.target.label, values: found.target.values });
        }

        const timer = setInterval(update, POLL_MS);
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        update();
        return () => {
            clearInterval(timer);
            if (lostTimer.current) clearTimeout(lostTimer.current);
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [targets]);

    useEffect(() => {
        // The click on the last target is the coach doing the step: let it go through, then close the guide.
        function onClick(event) {
            const found = current.current;
            if (found?.target.final && found.element.contains(event.target)) setTimeout(onClose, 0);
            // Whatever the coach just clicked may have finished the step: look again shortly instead of waiting for the poll.
            setTimeout(refresh, 1200);
        }
        function onKey(event) { if (event.key === 'Escape') onClose(); }
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose, refresh]);

    if (!spot) return null;

    const { rect } = spot;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // A target hugging a screen edge (the sidebar) gets its bubble BESIDE it, on the free side: above or below would
    // sit on top of the neighbouring menu items. Everything else gets it below, or above when there is no room.
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;
    const sideRoom = BUBBLE_WIDTH + ARROW_SIZE + RING_PADDING + VIEWPORT_MARGIN;
    const hugsEdge = Math.min(spaceLeft, spaceRight) < EDGE_HUG_PX && Math.max(spaceLeft, spaceRight) >= sideRoom;
    const side = hugsEdge ? (spaceRight >= spaceLeft ? 'right' : 'left') : null;

    const placeBelow = rect.bottom + RING_PADDING + BUBBLE_HEIGHT_ESTIMATE < window.innerHeight || rect.top < BUBBLE_HEIGHT_ESTIMATE;
    const bubbleLeft = side === 'right'
        ? rect.right + RING_PADDING + ARROW_SIZE
        : side === 'left'
            ? rect.left - RING_PADDING - ARROW_SIZE - BUBBLE_WIDTH
            : Math.min(Math.max(centerX - BUBBLE_WIDTH / 2, VIEWPORT_MARGIN), window.innerWidth - BUBBLE_WIDTH - VIEWPORT_MARGIN);
    const arrowLeft = Math.min(Math.max(centerX - bubbleLeft - ARROW_SIZE / 2, 0), BUBBLE_WIDTH - ARROW_SIZE);
    const bubbleTop = side ? centerY : placeBelow ? rect.bottom + RING_PADDING : rect.top - RING_PADDING;
    const bubbleShift = side ? 'translateY(-50%)' : placeBelow ? 'none' : 'translateY(-100%)';

    const label = (
        <div className={`flex items-start gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-lg ${side ? '' : placeBelow ? 'mt-7' : 'mb-7'}`}>
            <span className="flex-1 leading-snug">{t(spot.label, spot.values)}</span>
            <button type="button" onClick={onClose} aria-label={t('close')} className="shrink-0 rounded-full p-1 text-white/85 hover:text-white">
                <X size={14} aria-hidden="true" />
            </button>
        </div>
    );

    return createPortal(
        <>
            <div
                aria-hidden="true"
                className="ff-fade pointer-events-none fixed z-80 animate-pulse rounded-2xl border-2 border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]"
                style={{ top: rect.top - RING_PADDING, left: rect.left - RING_PADDING, width: rect.width + RING_PADDING * 2, height: rect.height + RING_PADDING * 2, transition: MOVE_TRANSITION }}
            />
            {/* Anchored by `top` and shifted with a transform, so moving between targets always animates. */}
            <div
                role="status"
                className="ff-fade fixed z-80"
                style={{ width: BUBBLE_WIDTH, left: bubbleLeft, top: bubbleTop, transform: bubbleShift, transition: MOVE_TRANSITION }}
            >
                {side ? (
                    <span
                        className="absolute"
                        style={{ top: '50%', marginTop: -ARROW_SIZE / 2, [side === 'right' ? 'left' : 'right']: -(ARROW_SIZE + 2) }}
                    >
                        {/* The bubble sits on the `side` of the target, so the arrow points back at it. */}
                        {side === 'right'
                            ? <ArrowLeft size={ARROW_SIZE} strokeWidth={3} className="ff-nudge text-red-500" style={{ '--nudge': '-5px' }} aria-hidden="true" />
                            : <ArrowRight size={ARROW_SIZE} strokeWidth={3} className="ff-nudge text-red-500" style={{ '--nudge': '5px' }} aria-hidden="true" />}
                    </span>
                ) : placeBelow && (
                    <ArrowUp size={ARROW_SIZE} strokeWidth={3} className="absolute animate-bounce text-red-500" style={{ left: arrowLeft, top: 0 }} aria-hidden="true" />
                )}
                {label}
                {!side && !placeBelow && (
                    <ArrowDown size={ARROW_SIZE} strokeWidth={3} className="absolute animate-bounce text-red-500" style={{ left: arrowLeft, bottom: 0 }} aria-hidden="true" />
                )}
            </div>
        </>,
        document.body,
    );
}

// Lets any checklist step start an arrow guide that follows the coach across pages until the step's last click.
export default function GuideProvider({ children }) {
    const [guide, setGuide] = useState(null);
    const startGuide = useCallback((key, context) => setGuide({ key, ...context }), []);
    const stopGuide = useCallback(() => setGuide(null), []);
    const value = useMemo(() => ({ startGuide, stopGuide }), [startGuide, stopGuide]);

    return (
        <GuideContext.Provider value={value}>
            {children}
            {guide && <GuideOverlay guide={guide} onClose={stopGuide} />}
        </GuideContext.Provider>
    );
}
