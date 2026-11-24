"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import { Popover } from "@heroui/react/popover";
import { Separator } from "@heroui/react/separator";
import { Switch } from "@heroui/react/switch";

// The queue header's one auto-assign entry point. Owners/managers get a button that opens a small panel:
// the "remember who I assign to" switch (with its explanation right beside it) and the way into the rules
// table. Everyone else, who can only look at the rules, gets a plain button that opens the table.
// While the switch is on the button says so, because the mode silently changes what the next assignment does.
export default function AutoAssignMenu({ total, canManage, isOn, onIsOnChange, onOpenRules }) {
    const t = useTranslations("plansQueue");
    const [isOpen, setIsOpen] = useState(false);

    if (!canManage) {
        return (
            <Button variant="outline" size="sm" className="max-sm:shrink-0" onPress={onOpenRules}>
                <Repeat className="w-4 h-4" />
                <span>{t("autoAssignRulesCount", { count: total })}</span>
            </Button>
        );
    }

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Button
                variant="outline"
                size="sm"
                aria-label={isOn ? t("autoAssignMenuOnLabel", { count: total }) : t("autoAssignMenuLabel", { count: total })}
                className={`max-sm:shrink-0 ${isOn ? "text-accent" : ""}`}
            >
                <Repeat className="w-4 h-4" />
                {/* The label drops out on phones so the button stays an icon with its count (and the On dot). */}
                <span className="max-sm:hidden">{t("autoAssignMenu")}</span>
                {isOn && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                        <span className="max-sm:hidden">{t("autoAssignOn")}</span>
                    </span>
                )}
                <span className="rounded-full bg-default px-1.5 text-xs font-semibold tabular-nums text-foreground">{total}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
            <Popover.Content className="sheet-popover w-80 max-w-[calc(100vw-2rem)] border border-border" placement="bottom end">
                {/* p-4: the switch's focus ring is drawn outside its box, so it needs room inside the card edge. */}
                <Popover.Dialog className="flex flex-col gap-4 p-4">
                    <Popover.Heading className="text-sm font-semibold text-foreground">{t("autoAssignMenu")}</Popover.Heading>
                    <Switch isSelected={isOn} onChange={onIsOnChange} className="flex w-full items-start gap-3">
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content className="flex flex-col gap-1">
                            <span className={`text-sm font-medium ${isOn ? "text-accent" : "text-foreground"}`}>{t("autoAssignMenuSwitch")}</span>
                            <span className="text-xs leading-snug text-muted-foreground">{t("autoAssignMenuHint")}</span>
                        </Switch.Content>
                    </Switch>
                    <Separator />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onPress={() => { setIsOpen(false); onOpenRules(); }}
                    >
                        <span className="flex items-center gap-2">
                            <Repeat className="w-4 h-4" />
                            {t("autoAssignManageRules", { count: total })}
                        </span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Button>
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
}
