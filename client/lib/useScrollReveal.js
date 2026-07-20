'use client';

import { useEffect, useRef } from 'react';

/**
 * Attach the returned ref to an element that also carries the
 * `animate-on-scroll` + a variant class (fade-in-up/-left/-right, see
 * globals.css). Adds `.visible` the first time the element enters the
 * viewport, then stops observing — the reveal only ever plays once.
 */
export function useScrollReveal(delay = 0) {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (delay > 0) {
                        setTimeout(() => node.classList.add('visible'), delay);
                    } else {
                        node.classList.add('visible');
                    }
                    observer.unobserve(node);
                }
            },
            { threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [delay]);

    return ref;
}
