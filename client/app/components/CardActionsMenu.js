"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Menu } from "@heroui/react/menu";
import { MenuTrigger, Button as AriaButton, Popover as AriaPopover } from "react-aria-components";

const ChevronRightIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const MoreIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
    </svg>
);

// Common menu-item icons, exported so callers compose item lists without
// redefining the same SVGs in every card file.
export const DuplicateIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);
export const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
);

/**
 * Trailing action slot shared by the plan / meal / day cards. Renders a chevron
 * at rest and swaps it for a kebab "⋯" dropdown on hover (or while the menu is
 * open), within a fixed footprint so the card layout never shifts.
 *
 * MUST be rendered inside an element carrying the `group` class (the card row) —
 * the hover swap relies on `group-hover`.
 *
 * @param {boolean} isActive   - card is selected (tints chevron/kebab primary)
 * @param {string}  ariaLabel  - accessible name for the trigger and the menu
 * @param {Array}   items      - [{ key, label, icon?, danger?, onSelect }]
 */
export default function CardActionsMenu({ isActive = false, ariaLabel, items = [] }) {
    const { resolvedTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative shrink-0 w-6 h-6" onClick={(e) => e.stopPropagation()}>
            <span className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-100 ${isOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0"} ${isActive ? "text-primary" : "text-muted-foreground/40"}`}>
                <ChevronRightIcon />
            </span>
            <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
                <AriaButton
                    aria-label={ariaLabel}
                    className={`absolute inset-0 flex items-center justify-center rounded-lg outline-none cursor-pointer text-muted-foreground hover:text-foreground hover:bg-default transition-all duration-100 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"}`}
                >
                    <MoreIcon />
                </AriaButton>
                <AriaPopover className={`${resolvedTheme === "dark" ? "dark" : ""} popover min-w-44 rounded-2xl! outline-none`} placement="bottom end" offset={6}>
                    <Menu
                        className="p-2! gap-0.5! outline-none focus:outline-none focus-visible:outline-none"
                        aria-label={ariaLabel}
                        onAction={(key) => items.find((i) => i.key === key)?.onSelect?.()}
                    >
                        {items.map((item) => (
                            <Menu.Item
                                key={item.key}
                                id={item.key}
                                variant={item.danger ? "danger" : undefined}
                                className={`rounded-2xl! px-3! py-2!${item.danger ? " text-danger!" : ""}`}
                            >
                                {item.icon}{item.label}
                            </Menu.Item>
                        ))}
                    </Menu>
                </AriaPopover>
            </MenuTrigger>
        </div>
    );
}
