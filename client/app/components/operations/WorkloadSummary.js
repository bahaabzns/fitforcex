"use client";

import { useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";
import { Alert } from "@heroui/react/alert";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Label } from "@heroui/react/label";
import { Meter } from "@heroui/react/meter";
import { Separator } from "@heroui/react/separator";
import { describeWorkload } from "@/app/components/operations/workloadInsights";
import NumberWithUnit from "@/app/components/NumberWithUnit";

// One HeroUI colour per team status; the chip, the meter and the main advice all use it.
const STATUS_COLOR = { healthy: "success", tight: "warning", overloaded: "danger" };

// Each piece of advice is a HeroUI Alert whose status says at a glance whether it is good news, a warning or a to-do.
const HINT_STATUS = {
    hintOverloaded: "danger",
    hintTight: "warning",
    hintHealthy: "success",
    hintUnassigned: "accent",
    hintSetLimits: "default",
};

// One headline number as a tile, the same look as the number tiles above the charts: label on top, the figure below.
function Figure({ label, value }) {
    return (
        <div className="min-w-0 rounded-xl bg-default/40 px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight mb-2 wrap-break-word">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums leading-none tracking-tight wrap-break-word"><NumberWithUnit value={value} /></p>
        </div>
    );
}

// The first thing a coach reads: how the team is doing in one glance (status, three numbers, and how long
// clearing everything would take against the goal), then plain advice with a button for the obvious next step.
// `wrapStatus` lets the page wrap the status chip (for the first-visit tour) without this component knowing about it.
export default function WorkloadSummary({ summary, onAction, onOpenHelp, wrapStatus = (node) => node }) {
    const t = useTranslations("operations");
    const { headline, busiest, hints } = describeWorkload(summary);
    const status = summary.utilization.status;
    const color = STATUS_COLOR[status] ?? "default";
    const isNormal = headline.key === "summaryNormal";
    const targetDays = summary.utilization.targetDays;

    const statusChip = (
        <Chip size="sm" color={color} variant="soft" className="whitespace-nowrap">
            <Chip.Label>{status ? t(`status_${status}`) : t("statusUnknown")}</Chip.Label>
        </Chip>
    );

    function actionLabel(hint) {
        if (hint.action === "assign") return t("actionAssign", { count: hint.assign.canTake, name: hint.assign.name });
        if (hint.action === "openQueue") return t("actionOpenQueue");
        return t("actionOpenUnassigned");
    }

    return (
        <Card className="rounded-xl h-full min-w-0">
            <Card.Header className="flex-row items-center justify-between gap-3">
                <div>{wrapStatus(statusChip)}</div>
                <Button variant="ghost" size="sm" isIconOnly onClick={onOpenHelp} aria-label={t("howItWorks")} title={t("howItWorks")}>
                    <CircleHelp size={16} />
                </Button>
            </Card.Header>

            {/* justify-between: when the card is stretched to match the chart beside it, the numbers, the meter and
                the advice spread over the height instead of leaving a gap at the bottom. */}
            <Card.Content className="flex flex-col gap-4 flex-1 justify-between">
                {isNormal ? (
                    <>
                        {/* Three numbers read faster than a sentence; the sentence stays for screen readers. */}
                        <p className="sr-only">{t(headline.key, headline.values)}</p>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2 sm:gap-3" aria-hidden="true">
                            <Figure label={t("sumWaiting")} value={headline.values.waiting} />
                            <Figure label={t("sumCanFinish")} value={t("trendPerDay", { count: headline.values.capacity })} />
                            <Figure label={t("sumToClear")} value={t("sumDays", { days: headline.values.days })} />
                        </div>
                        {targetDays ? (
                            <Meter
                                aria-label={t("sumGoalMeter")}
                                value={Math.min(100, (headline.values.days / targetDays) * 100)}
                                color={color}
                                valueLabel={t("sumGoalValue", { days: headline.values.days, goal: targetDays })}
                                className="w-full"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <Label>{t("sumGoalMeter")}</Label>
                                    <Meter.Output />
                                </div>
                                <Meter.Track>
                                    <Meter.Fill />
                                </Meter.Track>
                            </Meter>
                        ) : null}
                    </>
                ) : (
                    <p className="text-base font-medium text-foreground">{t(headline.key, headline.values)}</p>
                )}

                {busiest && (
                    <p className="text-sm text-muted-foreground">{t("summaryBusiest", { name: busiest.name, count: busiest.load })}</p>
                )}

                {hints.length > 0 && (
                    <>
                        <Separator />
                        <div className="flex flex-col gap-3">
                            {hints.map((hint) => (
                                <Alert key={hint.key} status={HINT_STATUS[hint.key] ?? "default"}>
                                    <Alert.Indicator />
                                    <Alert.Content className="min-w-0 wrap-break-word">
                                        <Alert.Title>{t(hint.key, hint.values)}</Alert.Title>
                                        {hint.action && (
                                            <div className="mt-2">
                                                <Button variant="secondary" size="sm" onClick={() => onAction(hint)}>{actionLabel(hint)}</Button>
                                            </div>
                                        )}
                                    </Alert.Content>
                                </Alert>
                            ))}
                        </div>
                    </>
                )}
            </Card.Content>
        </Card>
    );
}
