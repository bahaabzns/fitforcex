'use client';

import { useEffect } from 'react';

/**
 * React Aria's Modal marks every other top-level overlay `inert` while it's
 * open, for focus-trapping — including a Popover/Tooltip triggered from
 * inside the modal itself (e.g. a "New Feature" hint next to a form field,
 * or a plain info Tooltip), since it portals to its own separate DOM branch
 * that isn't recognized as "belonging to" the modal's own overlay tree.
 * `inert` removes an element from hit-testing entirely — clicks fall
 * straight through to whatever is underneath (a text field, a button) —
 * regardless of z-index, which is why raising z-index alone (see
 * globals.css Bug 10) wasn't enough: the overlay was never behind anything
 * visually, it was simply unclickable.
 *
 * Fix: whenever React Aria marks a top-level body child inert, if that
 * child contains a currently-rendered Popover/Tooltip overlay, un-inert it
 * immediately. Mounted once at the app root so every popover/tooltip in the
 * app is covered, not just one component's.
 */
export default function OverlayInertFix() {
    useEffect(() => {
        function clearStrandedInert() {
            for (const child of document.body.children) {
                if (child.inert && child.querySelector('.popover, .tooltip')) {
                    child.inert = false;
                }
            }
        }
        clearStrandedInert();
        const observer = new MutationObserver(clearStrandedInert);
        observer.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true });
        return () => observer.disconnect();
    }, []);

    return null;
}
