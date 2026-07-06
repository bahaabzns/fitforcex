"use client";

import { useTranslations } from "next-intl";
import { FieldLabel } from "@/app/components/Field";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";

/**
 * Package Lifecycle — per-variation default-forms picker. Two independent
 * multi-selects (same Select+ListBox pattern as the add-client wizard's forms
 * step): assessment forms are a flat id list; check-in forms carry a per-form
 * recurrence interval, entered inline once a form is checked.
 *
 * `formOptions`: [{ value: formId, label }]
 * `value`: { assessmentFormIds: string[], checkinForms: { formId, intervalDays }[] }
 */
export default function PackageFormsPicker({ formOptions, value, onChange }) {
    const t = useTranslations("packages");
    const assessmentFormIds = value?.assessmentFormIds ?? [];
    const checkinForms = value?.checkinForms ?? [];

    function setAssessmentFormIds(ids) {
        onChange({ ...value, assessmentFormIds: ids });
    }

    function setCheckinFormIds(ids) {
        const next = ids.map(formId =>
            checkinForms.find(c => c.formId === formId) || { formId, intervalDays: "" }
        );
        onChange({ ...value, checkinForms: next });
    }

    function setCheckinInterval(formId, intervalDays) {
        onChange({
            ...value,
            checkinForms: checkinForms.map(c => c.formId === formId ? { ...c, intervalDays } : c),
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("defaultAssessmentFormsLabel")}</FieldLabel>
                <Select
                    variant="secondary"
                    fullWidth
                    selectionMode="multiple"
                    placeholder={t("selectFormsPlaceholder")}
                    value={assessmentFormIds}
                    onChange={setAssessmentFormIds}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {formOptions.map(f => (
                                <ListBox.Item key={f.value} id={f.value} textValue={f.label}>
                                    {f.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
                <p className="text-xs text-muted-foreground">{t("defaultAssessmentFormsHint")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("defaultCheckinFormsLabel")}</FieldLabel>
                <Select
                    variant="secondary"
                    fullWidth
                    selectionMode="multiple"
                    placeholder={t("selectFormsPlaceholder")}
                    value={checkinForms.map(c => c.formId)}
                    onChange={setCheckinFormIds}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {formOptions.map(f => (
                                <ListBox.Item key={f.value} id={f.value} textValue={f.label}>
                                    {f.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
                <p className="text-xs text-muted-foreground">{t("defaultCheckinFormsHint")}</p>

                {checkinForms.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                        {checkinForms.map(c => {
                            const form = formOptions.find(f => f.value === c.formId);
                            return (
                                <div key={c.formId} className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{form?.label || c.formId}</span>
                                    <TextField
                                        variant="secondary"
                                        aria-label={t("intervalDaysPlaceholder")}
                                        className="w-28 shrink-0"
                                        value={String(c.intervalDays ?? "")}
                                        onChange={(val) => setCheckinInterval(c.formId, val)}
                                    >
                                        <Input type="number" min="1" inputMode="numeric" placeholder={t("intervalDaysPlaceholder")} />
                                    </TextField>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
