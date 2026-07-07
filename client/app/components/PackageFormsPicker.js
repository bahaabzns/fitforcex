"use client";

import { useTranslations } from "next-intl";
import { FieldLabel } from "@/app/components/Field";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";

// One assessment or check-in multi-select field -- same Select+ListBox
// pattern as the add-client wizard's forms step.
function FormsSelectField({ label, hint, formOptions, selectedIds, onChange }) {
    const t = useTranslations("packages");
    return (
        <div className="flex flex-col gap-1.5">
            <FieldLabel>{label}</FieldLabel>
            <Select
                variant="secondary"
                fullWidth
                selectionMode="multiple"
                placeholder={t("selectFormsPlaceholder")}
                value={selectedIds}
                onChange={onChange}
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
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}

/**
 * Package Lifecycle — per-variation default-forms picker.
 *
 * Post-review refinement: check-in defaults are now two independent
 * multi-selects, one per plan type, instead of a single mixed field -- a
 * Nutrition Plan activation must never pre-fill a Training check-in form
 * (and vice versa). Each is pre-filtered by the caller to only the forms
 * compatible with that plan type (form_type='check-in' + matching
 * post_action -- see `isCompatibleCheckInForm`), not by hardcoded names.
 *
 * `assessmentFormOptions` / `nutritionCheckinFormOptions` / `trainingCheckinFormOptions`: [{ value: formId, label }]
 * `value`: { assessmentFormIds: string[], nutritionCheckinForms: { formId }[], trainingCheckinForms: { formId }[] }
 */
export default function PackageFormsPicker({ assessmentFormOptions, nutritionCheckinFormOptions, trainingCheckinFormOptions, value, onChange }) {
    const t = useTranslations("packages");
    const assessmentFormIds = value?.assessmentFormIds ?? [];
    const nutritionCheckinForms = value?.nutritionCheckinForms ?? [];
    const trainingCheckinForms = value?.trainingCheckinForms ?? [];

    return (
        <div className="flex flex-col gap-4">
            <FormsSelectField
                label={t("defaultAssessmentFormsLabel")}
                hint={t("defaultAssessmentFormsHint")}
                formOptions={assessmentFormOptions}
                selectedIds={assessmentFormIds}
                onChange={(ids) => onChange({ ...value, assessmentFormIds: ids })}
            />
            <FormsSelectField
                label={t("defaultNutritionCheckinFormsLabel")}
                hint={t("defaultNutritionCheckinFormsHint")}
                formOptions={nutritionCheckinFormOptions}
                selectedIds={nutritionCheckinForms.map(c => c.formId)}
                onChange={(ids) => onChange({ ...value, nutritionCheckinForms: ids.map(formId => ({ formId })) })}
            />
            <FormsSelectField
                label={t("defaultTrainingCheckinFormsLabel")}
                hint={t("defaultTrainingCheckinFormsHint")}
                formOptions={trainingCheckinFormOptions}
                selectedIds={trainingCheckinForms.map(c => c.formId)}
                onChange={(ids) => onChange({ ...value, trainingCheckinForms: ids.map(formId => ({ formId })) })}
            />
        </div>
    );
}
