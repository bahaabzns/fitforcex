"use client";

import { Tabs } from "@heroui/react/tabs";
import ScrollHint from "@/app/components/ScrollHint";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// The page's category list, as on Settings and the dashboard: a vertical list on the left that stays pinned
// while the page scrolls; on a phone it becomes a strip across the top (pinned there too) that scrolls
// sideways, with the arrow-and-fade hint when more tabs are off-screen.
//
// `items`: [{ id, label }] where label is any node (an icon and a count chip work). Only the list is drawn —
// the page shows the selected content itself. `navRef` lets a page measure the strip (the dashboard does,
// to place its pinned period bars right under it).
export default function StickySideTabs({ items, selectedKey, onSelectionChange, ariaLabel, navRef }) {
    const isPhone = useMediaQuery("(max-width: 767px)");

    const tabs = (
        <Tabs
            orientation={isPhone ? "horizontal" : "vertical"}
            variant="secondary"
            selectedKey={selectedKey}
            onSelectionChange={(key) => onSelectionChange(String(key))}
        >
            <Tabs.ListContainer>
                <Tabs.List aria-label={ariaLabel} className="max-md:w-max">
                    {items.map((item) => (
                        <Tabs.Tab key={item.id} id={item.id}>
                            {item.label}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs.ListContainer>
        </Tabs>
    );

    return (
        <nav
            ref={navRef}
            aria-label={ariaLabel}
            className="max-md:sticky max-md:top-0 max-md:z-50 max-md:-mx-4 max-md:border-b max-md:border-border max-md:bg-background max-md:px-4 md:sticky md:top-4 md:z-10 md:w-55 md:shrink-0 md:self-start"
        >
            {isPhone ? <ScrollHint>{tabs}</ScrollHint> : tabs}
        </nav>
    );
}
