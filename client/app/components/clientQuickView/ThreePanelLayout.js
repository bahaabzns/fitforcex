"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@heroui/react/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMobilePanels } from "@/hooks/useMobilePanels";

/**
 * The builders' list → detail → deep-detail layout for the quick view, with the same
 * breakpoints as the builder pages:
 *   ≥1280px   three columns
 *   768–1279  list + detail; the deepest panel slides over from the end edge
 *   <768      one panel per screen, swipeable, with a back button
 *
 * `left` / `middle` / `right` are render functions receiving `{ goToStep }` so a selection can
 * move the phone view to the next panel (0 = list, 1 = detail, 2 = deep detail).
 * `hasMiddle` / `hasRight` say whether those panels have something selected.
 */
export default function ThreePanelLayout({ left, middle, right, hasMiddle, hasRight, onCloseRight }) {
    const t = useTranslations("clientQuickView");
    const isNarrow = useMediaQuery("(max-width: 1279px)");
    const isMobile = useMediaQuery("(max-width: 767px)");
    const { step, goToStep, swipeHandlers, panelStyle } = useMobilePanels({
        isMobile,
        maxStep: hasRight ? 2 : hasMiddle ? 1 : 0,
    });
    const slots = { goToStep };

    const phonePanelClass = "w-full shrink-0 flex flex-col min-h-0 min-w-0 overflow-hidden";

    return (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
            {isMobile && step > 0 && (
                <Button variant="ghost" size="sm" className="self-start -ms-2 gap-1 text-muted-foreground" onPress={() => goToStep(step - 1)}>
                    <ChevronLeft size={16} className="rtl:rotate-180" />
                    {t("back")}
                </Button>
            )}

            <div className={`relative flex flex-1 min-h-0 overflow-hidden ${isMobile ? "" : "gap-2"}`} {...swipeHandlers}>
                <div
                    style={isMobile ? panelStyle : undefined}
                    className={isMobile ? phonePanelClass : `flex flex-col min-h-0 overflow-hidden shrink-0 ${isNarrow ? "w-[38%]" : "w-[30%]"}`}
                >
                    {left(slots)}
                </div>

                <div
                    style={isMobile ? panelStyle : undefined}
                    className={isMobile ? phonePanelClass : "flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"}
                >
                    {middle(slots)}
                </div>

                {isMobile ? (
                    hasRight && (
                        <div style={panelStyle} className={phonePanelClass}>
                            {right(slots)}
                        </div>
                    )
                ) : isNarrow ? (
                    hasRight && (
                        <>
                            <div className="absolute inset-0 z-10 rounded-2xl bg-black/40" onClick={onCloseRight} />
                            <div className="absolute inset-y-0 inset-e-0 z-20 flex w-[min(28rem,92%)] flex-col gap-1">
                                <div className="flex justify-end shrink-0">
                                    <Button isIconOnly size="sm" variant="secondary" aria-label={t("closeDetails")} onPress={onCloseRight}>
                                        <X size={15} />
                                    </Button>
                                </div>
                                <div className="flex flex-1 min-h-0 flex-col">{right(slots)}</div>
                            </div>
                        </>
                    )
                ) : (
                    <div className="w-[34%] shrink-0 flex flex-col min-h-0 overflow-hidden">
                        {right(slots)}
                    </div>
                )}
            </div>
        </div>
    );
}
