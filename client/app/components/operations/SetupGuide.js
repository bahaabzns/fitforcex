"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";
import { SUGGESTED_DAILY_CAPACITY } from "@/app/components/operations/workloadInsights";
import DaysOffPicker from "@/app/components/operations/DaysOffPicker";

const inputCls = "w-24 px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors";

// Shown while no one has a daily limit: explains why it is needed and offers a one-click start.
export default function SetupGuide({ hasUnsetMembers, onDone, onSetOwnLimit }) {
    const t = useTranslations("operations");
    const { workspaceSlug } = useParams();
    const [value, setValue] = useState(String(SUGGESTED_DAILY_CAPACITY));
    const [daysOff, setDaysOff] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const number = Number(value);
    const isValid = Number.isInteger(number) && number >= 1 && number <= 500 && daysOff.length < 7;

    async function handleBulkSet() {
        setSaving(true);
        setError("");
        try {
            await api.post("/api/operations/capacity/bulk", { dailyCapacity: number, daysOff });
            onDone();
        } catch {
            setError(t("setupBulkFailed"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card className="rounded-xl border border-dashed border-border">
            <Card.Content className="p-5 flex items-start gap-3">
                <Users size={18} className="text-primary mt-0.5 shrink-0" />
                <div className="flex flex-col gap-3 min-w-0">
                    <div>
                        <p className="text-sm font-semibold text-foreground">{t("setupTitle")}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t("setupIntro")}</p>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {hasUnsetMembers ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-foreground">1. {t("setupStep1")}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="text-sm text-muted-foreground" htmlFor="ops-bulk-capacity">{t("setupBulkLabel")}</label>
                                <input
                                    id="ops-bulk-capacity" type="number" inputMode="numeric" min={1} max={500} step={1}
                                    value={value} onChange={(e) => setValue(e.target.value)} className={inputCls}
                                />
                                <Button variant="primary" onClick={handleBulkSet} isDisabled={saving || !isValid}>
                                    {saving ? t("saving") : t("setupBulkButton")}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">{t("setupHint")}</p>
                            <div className="flex flex-col gap-1.5 mt-1">
                                <span className="text-sm text-muted-foreground">{t("setupDaysOff")}</span>
                                <DaysOffPicker value={daysOff} onChange={setDaysOff} ariaLabel={t("daysOffLabel")} />
                            </div>
                            <p className="text-sm text-foreground mt-1">2. {t("setupStep2")}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">{t("setupNobody")}</p>
                            <p className="text-xs text-muted-foreground">{t("setupHint")}</p>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="ghost" onClick={onSetOwnLimit}>{t("setupOwnerButton")}</Button>
                        <Link href={`/${workspaceSlug}/team`} className="text-sm text-primary hover:text-primary/80">
                            {t("setupTeamLink")} →
                        </Link>
                    </div>
                </div>
            </Card.Content>
        </Card>
    );
}
