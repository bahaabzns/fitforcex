'use client';
import { useTranslations } from 'next-intl';
import { FieldLabel } from "@/app/components/Field";
import { ModalFooter } from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";

const NUTRITION_FIELDS = [
    { name: "calories_per_serving", labelKey: "labelCalories", unitKey: "unitKcal" },
    { name: "carbs_per_serving",    labelKey: "labelCarbs",    unitKey: "unitGrams" },
    { name: "protein_per_serving",  labelKey: "labelProtein",  unitKey: "unitGrams" },
    { name: "fats_per_serving",     labelKey: "labelFats",     unitKey: "unitGrams" },
];

// Shared food item form used in the Food Items management page and the inline
// "Create food" flow inside FoodItemsModal. Manages its own translations from
// the "foodItems" namespace so callers don't need to thread them through.
export default function FoodForm({ data, onChange, onSubmit, onCancel, submitLabel, isEdit = false, categories = [] }) {
    const t = useTranslations("foodItems");
    const tCommon = useTranslations("common");

    const field = (name) => ({
        value: data[name] || '',
        onChange: (value) => onChange({ target: { name, value } }),
    });

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-1 py-1">
            <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                    <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                    <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} {...field("name_en")}>
                        <Input type="text" placeholder={t("placeholderNameEn")} autoFocus={!isEdit} />
                    </TextField>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                    <FieldLabel>{t("labelNameAr")}</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} {...field("name_ar")}>
                        <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                    </TextField>
                    {/* Not required — some workspaces are English-only — but an Arabic
                        client viewing this item without one sees the English name
                        substituted in, so flag it rather than leave it silent. */}
                    {!data.name_ar && (
                        <p className="text-xs text-amber-500">{t("missingArabicNameHint")}</p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("labelCategory")}</FieldLabel>
                <Select
                    variant="secondary"
                    fullWidth
                    placeholder={t("selectCategory")}
                    aria-label={t("labelCategory")}
                    value={data.food_category || ''}
                    onChange={(key) => onChange({ target: { name: "food_category", value: key } })}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {categories.map(cat => (
                                <ListBox.Item key={cat.id} id={cat.name_en} textValue={cat.name_en}>
                                    {cat.name_en}{cat.name_ar ? ` / ${cat.name_ar}` : ''}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>
            <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                    <FieldLabel>{t("labelServingSize")}</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label={t("labelServingSize")} {...field("serving_size")}>
                        <Input type="number" step="any" inputMode="decimal" placeholder="100" />
                    </TextField>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                    <FieldLabel>{t("labelServingUnit")}</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label={t("labelServingUnit")} {...field("serving_unit")}>
                        <Input type="text" placeholder="g" />
                    </TextField>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("labelNutritionFacts")}</FieldLabel>
                <div className="grid grid-cols-4 gap-3">
                    {NUTRITION_FIELDS.map(({ name, labelKey, unitKey }) => (
                        <div key={name} className="flex flex-col gap-1">
                            {/* Visible label: the placeholder alone disappears once a value is entered. */}
                            <span className="text-xs text-muted-foreground">{t(labelKey)} ({t(unitKey)})</span>
                            <TextField variant="secondary" fullWidth aria-label={t(labelKey)} {...field(name)}>
                                <Input type="number" step="any" inputMode="decimal" placeholder={t(labelKey)} />
                            </TextField>
                        </div>
                    ))}
                </div>
            </div>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>{tCommon("cancel")}</Button>
                <Button type="submit" variant="primary">{submitLabel}</Button>
            </ModalFooter>
        </form>
    );
}
