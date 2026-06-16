'use client';

import { Toolbar } from "@heroui/react/toolbar";
import { cn } from "@/lib/utils";

/**
 * Floating pill toolbar for contextual/bulk actions, modeled on HeroUI Pro's
 * ActionBar. Built on the free @heroui/react Toolbar primitive plus the
 * documented `.action-bar*` classes (defined in globals.css), so we don't need
 * the paid @heroui-pro/react package.
 *
 * Prefix / Content / Suffix are all optional. Put a <Separator /> between
 * sections as needed. Visibility (with an animated enter/exit) is driven by
 * `isOpen`; the bar stays mounted so the exit transition can play.
 *
 * @param {boolean} isOpen - controls visibility with animated enter/exit
 * @param {boolean} [isAttached=true] - surface background + full rounding
 * @param {"horizontal" | "vertical"} [orientation="horizontal"]
 */
export default function ActionBar({
    isOpen,
    isAttached = true,
    orientation = "horizontal",
    className,
    children,
    "aria-label": ariaLabel = "Actions",
    ...props
}) {
    return (
        // data-open on the outer band drives both the backdrop scrim and the
        // pill's enter/exit, so the whole thing only shows while `isOpen`.
        <div className="action-bar" data-open={isOpen ? "true" : "false"} aria-hidden={!isOpen}>
            <Toolbar
                aria-label={ariaLabel}
                orientation={orientation}
                className={cn("action-bar__wrapper", className)}
                data-attached={isAttached ? "true" : "false"}
                {...props}
            >
                {children}
            </Toolbar>
        </div>
    );
}

function Prefix({ children, className }) {
    return <div className={cn("action-bar__prefix", className)}>{children}</div>;
}

function Content({ children, className }) {
    return <div className={cn("action-bar__content", className)}>{children}</div>;
}

function Suffix({ children, className }) {
    return <div className={cn("action-bar__suffix", className)}>{children}</div>;
}

ActionBar.Prefix = Prefix;
ActionBar.Content = Content;
ActionBar.Suffix = Suffix;
