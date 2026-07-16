"use client";

import { ScrollShadow as HeroScrollShadow } from "@heroui/react/scroll-shadow";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// HeroUI's fade effect masks the container with `mask-image: linear-gradient(...)`.
// Combined with dnd-kit's transformed drag rows, that mask triggers a known
// tablet-GPU compositing bug where the whole scroll area paints solid black
// instead of applying the gradient. Coarse-pointer (touch) devices skip the
// mask entirely rather than risk it; callers can still override via `isEnabled`.
export function ScrollShadow({ isEnabled, ...props }) {
    const isCoarsePointer = useMediaQuery("(pointer: coarse)");
    return <HeroScrollShadow isEnabled={isEnabled ?? !isCoarsePointer} {...props} />;
}
