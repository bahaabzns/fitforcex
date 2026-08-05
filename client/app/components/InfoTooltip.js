'use client';

import { Info } from "lucide-react";
import { Tooltip } from "@heroui/react/tooltip";
import { Button } from "@heroui/react/button";

/**
 * Small "i" icon that reveals helper text on hover/focus — for a field-level
 * note that would otherwise sit as a line of muted text under the input
 * (e.g. "Defines how this exercise is prescribed and logged, everywhere
 * it's used."). Usually placed via FieldLabel's `hint` prop rather than
 * used directly.
 *
 * The trigger MUST be a HeroUI-aware component (Button) — Tooltip's
 * hover/focus wiring comes from React Aria context that a plain <span>
 * never picks up, so the icon would render but never actually show its
 * tooltip on hover.
 *
 * Sized to h-6 w-6 (24px) rather than Button's natural icon-only-sm size
 * (~32-36px, too wide next to inline label text) or an even tighter custom
 * size (too small a hover target to reliably land on — that was the bug:
 * shrinking below ~24px made hovering feel flaky since the cursor kept
 * missing the box).
 */
export default function InfoTooltip({ text }) {
    if (!text) return null;
    return (
        <Tooltip>
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={text}
                className="h-6 w-6 min-w-0 text-muted-foreground/60 hover:text-foreground"
            >
                <Info className="w-3.5 h-3.5" />
            </Button>
            <Tooltip.Content className="max-w-64">{text}</Tooltip.Content>
        </Tooltip>
    );
}
