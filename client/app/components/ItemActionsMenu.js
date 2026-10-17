"use client";

import { useTheme } from "next-themes";
import { Menu } from "@heroui/react/menu";
import { MenuTrigger, Button as AriaButton, Popover as AriaPopover } from "react-aria-components";
import { MoreVertical } from "lucide-react";

/**
 * Always-visible "⋯" menu that groups a row's secondary actions on narrow screens.
 * @param {string} ariaLabel - accessible name for the trigger and menu
 * @param {Array}  items     - [{ key, label, icon?, danger?, onSelect }]
 */
export default function ItemActionsMenu({ ariaLabel, items = [] }) {
    const { resolvedTheme } = useTheme();

    return (
        <MenuTrigger>
            <AriaButton
                aria-label={ariaLabel}
                className="flex items-center justify-center w-8 h-8 rounded-lg outline-none cursor-pointer text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
            >
                <MoreVertical size={18} />
            </AriaButton>
            <AriaPopover className={`${resolvedTheme === "dark" ? "dark" : ""} popover sheet-menu min-w-44 rounded-2xl! outline-none`} placement="bottom end" offset={6}>
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
    );
}
