"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Input } from "@heroui/react/input";
import { TextField } from "@heroui/react/textfield";
import api from "@/lib/axios";
import { SUGGESTED_DAILY_CAPACITY } from "@/app/components/operations/workloadInsights";
import DaysOffPicker from "@/app/components/operations/DaysOffPicker";

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

    // On a wide screen the guide is a compact three-column row (start number | days off | next steps) so it does not
    // eat the page; on a phone the same blocks simply stack.
    return (
        <Card className="rounded-xl border border-dashed border-border">
            <Card.Content className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <Users size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t("setupTitle")}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{t("setupIntro")}</p>
                    </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}

                {hasUnsetMembers ? (
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 *:min-w-0 lg:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-foreground">1. {t("setupStep1")}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <TextField variant="secondary" aria-label={t("setupBulkLabel")} value={value} onChange={setValue} className="w-20">
                                    <Input type="number" inputMode="numeric" min={1} max={500} step={1} />
                                </TextField>
                                <span className="text-sm text-muted-foreground">{t("setupBulkLabel")}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t("setupHint")}</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">{t("setupDaysOff")}</p>
                            <DaysOffPicker value={daysOff} onChange={setDaysOff} ariaLabel={t("daysOffLabel")} />
                        </div>

                        <div className="flex flex-col items-start gap-2">
                            <p className="text-sm font-medium text-foreground">2. {t("setupStep2")}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="primary" onClick={handleBulkSet} isDisabled={saving || !isValid}>
                                    {saving ? t("saving") : t("setupBulkButton")}
                                </Button>
                                <Button variant="ghost" onClick={onSetOwnLimit}>{t("setupOwnerButton")}</Button>
                                <Link href={`/${workspaceSlug}/team`} className="text-sm text-primary hover:text-primary/80">
                                    {t("setupTeamLink")} →
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <p className="text-sm text-muted-foreground">{t("setupNobody")}</p>
                        <p className="text-xs text-muted-foreground">{t("setupHint")}</p>
                        <Button variant="ghost" onClick={onSetOwnLimit}>{t("setupOwnerButton")}</Button>
                        <Link href={`/${workspaceSlug}/team`} className="text-sm text-primary hover:text-primary/80">
                            {t("setupTeamLink")} →
                        </Link>
                    </div>
                )}
            </Card.Content>
        </Card>
    );
}
