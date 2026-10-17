"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import { Description } from "@heroui/react/description";
import { Drawer } from "@heroui/react/drawer";
import { NumberField } from "@heroui/react/number-field";
import { Separator } from "@heroui/react/separator";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import DaysOffPicker from "@/app/components/operations/DaysOffPicker";
import CapacityHistoryList from "@/app/components/operations/CapacityHistoryList";

const MAX_DAILY_PLAN_CAPACITY = 500; // mirrors the server's operations.constants.ts

// Sets one person's plans per working day and their weekly days off, and shows the change history
// underneath. On a phone it slides up as a bottom sheet; on wider screens it is a modal. `endpoint` is the PUT target (a member's, or the owner's); an empty limit saves null,
// which means "not counted". `suggestedValue` pre-fills the field for someone with no limit yet, so a
// first-time coach is not staring at an empty box. `userId` (when known) turns on the history list.
export default function CapacityEditModal({
    name, userId, currentValue, currentDaysOff = [], suggestedValue, endpoint, hint, onClose, onSaved,
}) {
    const t = useTranslations("operations");
    const usingSuggestion = (currentValue === null || currentValue === undefined) && suggestedValue != null;
    const [limit, setLimit] = useState(currentValue ?? suggestedValue ?? null);   // null = not set
    const [daysOff, setDaysOff] = useState(currentDaysOff);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    // This component only mounts after a tap, so the window is always there to ask.
    const [isPhone] = useState(() => window.matchMedia("(max-width: 639px)").matches);

    async function handleSave() {
        if (daysOff.length >= 7) {
            setError(t("daysOffAll"));
            return;
        }
        setSaving(true);
        setError("");
        try {
            await api.put(endpoint, { dailyCapacity: limit, daysOff });
            onSaved(limit, daysOff);
            onClose();
        } catch {
            setError(t("capacitySaveFailed"));
        } finally {
            setSaving(false);
        }
    }

    const buttons = (
        <>
            <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
            <Button onClick={handleSave} isDisabled={saving} variant="primary">
                {saving ? t("saving") : t("save")}
            </Button>
        </>
    );

    const fields = (
        <>
            {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("capacityLabel")}</FieldLabel>
                <NumberField
                    variant="secondary"
                    aria-label={t("capacityLabel")}
                    // react-aria treats NaN as "empty", which is how an unset limit is shown.
                    value={limit ?? Number.NaN}
                    onChange={(next) => setLimit(Number.isNaN(next) ? null : next)}
                    minValue={0}
                    maxValue={MAX_DAILY_PLAN_CAPACITY}
                    step={1}
                    className="w-40"
                >
                    <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input placeholder={t("capacityNotSet")} />
                        <NumberField.IncrementButton />
                    </NumberField.Group>
                </NumberField>
                <Description>{usingSuggestion ? t("capacitySuggested") : (hint ?? t("capacityHint"))}</Description>
            </div>

            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("daysOffLabel")}</FieldLabel>
                <DaysOffPicker value={daysOff} onChange={setDaysOff} ariaLabel={t("daysOffLabel")} />
                <Description>{t("daysOffHint")}</Description>
            </div>

            {userId && (
                <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{t("historySection")}</h3>
                        {/* In the phone sheet the sheet itself scrolls, so the list does not get a scroll area of its own. */}
                        <CapacityHistoryList userId={userId} maxHeightClass={isPhone ? "max-h-none" : undefined} />
                    </div>
                </>
            )}
        </>
    );

    if (isPhone) {
        return (
            <Drawer isOpen onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
                <Drawer.Backdrop isDismissable>
                    <Drawer.Content placement="bottom">
                        <Drawer.Dialog className="flex max-h-[90vh] flex-col rounded-t-2xl bg-background">
                            <Drawer.Handle />
                            <Drawer.Header className="px-5 pt-2 pb-3">
                                <Drawer.Heading className="text-base font-semibold text-foreground">{t("capacityModalTitle", { name })}</Drawer.Heading>
                            </Drawer.Header>
                            <Drawer.Body className="flex flex-col gap-5 overflow-y-auto overflow-x-hidden px-5 pb-2">{fields}</Drawer.Body>
                            <Drawer.Footer className="flex gap-2 px-5 py-4 [&>*]:flex-1">{buttons}</Drawer.Footer>
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>
        );
    }

    return (
        <Modal open onClose={onClose} title={t("capacityModalTitle", { name })}>
            {/* The padding gives focus rings room: the modal body clips anything that pokes out of it. */}
            <div className="flex flex-col gap-5 p-1">
                {fields}
                <div className="flex gap-2 justify-end pt-1">{buttons}</div>
            </div>
        </Modal>
    );
}
