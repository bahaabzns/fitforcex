"use client";

import { useTranslations } from "next-intl";
import { FieldLabel } from "@/app/components/Field";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";

/**
 * Package Lifecycle — per-variation default-forms picker. Two independent
 * multi-selects (same Select+ListBox pattern as the add-client wizard's forms
 * step): assessment forms are a flat id list; check-in forms are also a flat
 * id list -- each fires once, automatically, when the plan's duration ends.
 *
 * `formOptions`: [{ value: formId, label }]
 * `value`: { assessmentFormIds: string[], checkinForms: { formId }[] }
 */
export default function PackageFormsPicker({ formOptions, value, onChange }) {
    const t = useTranslations("packages");
    const assessmentFormIds = value?.assessmentFormIds ?? [];
    const checkinForms = value?.checkinForms ?? [];

    function setAssessmentFormIds(ids) {
        onChange({ ...value, assessmentFormIds: ids });
    }

    function setCheckinFormIds(ids) {
        onChange({ ...value, checkinForms: ids.map(formId => ({ formId })) });
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
            </div>
        </div>
    );
}
