"use client";

import { useTheme } from "next-themes";
import { Menu } from "@heroui/react/menu";
import { Button } from "@heroui/react/button";
import { MenuTrigger, Popover as AriaPopover } from "react-aria-components";

// The plan builders' single "Export PDF" control. With one branding profile it
// exports straight away on click; with several, clicking opens a dropdown to
// pick which profile to export with (the default one is marked). Menu markup
// mirrors CardActionsMenu / QuestionsPanel.
export default function PdfExportButton({
    profiles = [],
    disabled = false,
    busy = false,
    label,
    busyLabel,
    dirtyTitle,
    defaultSuffix = "",
    onExport,
}) {
    const { resolvedTheme } = useTheme();
    const named = Array.isArray(profiles) ? profiles.filter((p) => p.id) : [];
    const text = busy ? busyLabel : label;

    if (named.length < 2) {
        return (
            <Button variant="outline" isDisabled={disabled} title={dirtyTitle} onClick={() => onExport?.()}>
                {text}
            </Button>
        );
    }

    return (
        <MenuTrigger>
            <Button variant="outline" isDisabled={disabled} title={dirtyTitle}>
                {text}
            </Button>
            <AriaPopover
                className={`${resolvedTheme === "dark" ? "dark" : ""} popover min-w-52 rounded-2xl! outline-none`}
                placement="bottom end"
                offset={6}
            >
                <Menu
                    className="p-2! gap-0.5! outline-none focus:outline-none focus-visible:outline-none"
                    aria-label={label}
                    onAction={(key) => onExport?.(String(key))}
                >
                    {named.map((p) => (
                        <Menu.Item key={p.id} id={p.id} className="rounded-2xl! px-3! py-2!">
                            {p.is_default ? `${p.name} ${defaultSuffix}`.trim() : p.name}
                        </Menu.Item>
                    ))}
                </Menu>
            </AriaPopover>
        </MenuTrigger>
    );
}
