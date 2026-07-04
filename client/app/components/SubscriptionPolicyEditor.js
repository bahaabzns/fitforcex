"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Label } from "@heroui/react/label";
import { Button } from "@heroui/react/button";
import { NumberField } from "@heroui/react/number-field";
import { Switch } from "@heroui/react/switch";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Disclosure } from "@heroui/react/disclosure";
import { DisclosureGroup } from "@heroui/react/disclosure-group";
import { PERMISSION_KEYS, COMING_SOON, defaultPolicy } from "@/app/components/SubscriptionPolicyFields";
import { PRESET_KEYS, PRESET_FLAGS, detectPreset, pickPermissionFlags, PERMISSION_GROUPS, PERMISSION_ICONS } from "@/app/components/subscriptionPolicyPresets";

const ALL_ENABLED = PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});

/**
 * Per-scope policy editor: preset picker (auto-configures the 10 switches),
 * an always-visible grace period field for the expired scope, and — only when
 * "Custom" is selected — bulk actions plus the 5 grouped permission accordions.
 */
export default function SubscriptionPolicyEditor({ scope, value, onChange, onCopy, onPaste, canPaste, copiedFromLabel }) {
    const t = useTranslations("subscriptionPolicies");
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [expandedKeys, setExpandedKeys] = useState(() => new Set(PERMISSION_GROUPS.map(g => g.key)));

    const effectivePreset = selectedPreset ?? detectPreset(value);
    const isCustom = effectivePreset === "custom";

    function handlePresetChange(key) {
        setSelectedPreset(key);
        if (key !== "custom") onChange({ ...value, ...PRESET_FLAGS[key] });
    }

    function setAllFlags(flags) {
        onChange({ ...value, ...flags });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <Label>{t("presetLabel")}</Label>
                <Select variant="secondary" fullWidth value={effectivePreset} onChange={handlePresetChange}>
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {PRESET_KEYS.map(key => (
                                <ListBox.Item key={key} id={key} textValue={t(`preset.${key}.label`)}>
                                    {t(`preset.${key}.label`)}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>

            {scope === "expired" && (
                <div className="flex flex-col gap-1.5">
                    <Label>{t("gracePeriodLabel")}</Label>
                    <NumberField
                        value={value.grace_period_days ?? 0}
                        onChange={(next) => onChange({ ...value, grace_period_days: Math.max(0, next || 0) })}
                        minValue={0}
                        maxValue={3650}
                        aria-label={t("gracePeriodLabel")}
                    >
                        <NumberField.Group className="w-36">
                            <NumberField.DecrementButton />
                            <NumberField.Input />
                            <NumberField.IncrementButton />
                        </NumberField.Group>
                    </NumberField>
                    <p className="text-xs text-muted-foreground">{t("gracePeriodHelp")}</p>
                </div>
            )}

            {!isCustom && (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2.5">
                    {t(`preset.${effectivePreset}.description`)}
                </p>
            )}

            {isCustom && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAllFlags(ALL_ENABLED)}>
                            {t("bulk.enableAll")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAllFlags(PRESET_FLAGS.locked)}>
                            {t("bulk.disableAll")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onChange(defaultPolicy(scope))}>
                            {t("bulk.resetDefaults")}
                        </Button>
                        <Separator orientation="vertical" className="h-5" />
                        <Button size="sm" variant="ghost" onClick={() => onCopy(scope, pickPermissionFlags(value))}>
                            {t("bulk.copy")}
                        </Button>
                        <Button size="sm" variant="ghost" isDisabled={!canPaste} onClick={onPaste}>
                            {canPaste ? t("bulk.pasteFrom", { scope: copiedFromLabel }) : t("bulk.paste")}
                        </Button>
                    </div>

                    <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col gap-2">
                        {PERMISSION_GROUPS.map(group => {
                            const GroupIcon = group.icon;
                            const enabled = group.permissionKeys.filter(key => value[key] === true).length;
                            const total = group.permissionKeys.length;
                            return (
                                <Disclosure key={group.key} id={group.key} className="rounded-lg border border-border overflow-hidden">
                                    <Disclosure.Heading>
                                        <Disclosure.Trigger className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/40 transition-colors">
                                            <GroupIcon size={16} className="text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium text-foreground">{t(group.titleKey)}</span>
                                            <span className="text-xs text-muted-foreground">
                                                • {t("groupEnabledCount", { enabled, total })}
                                            </span>
                                            <Disclosure.Indicator />
                                        </Disclosure.Trigger>
                                    </Disclosure.Heading>
                                    <Disclosure.Content>
                                        <Disclosure.Body className="px-3 pb-1 pt-0 flex flex-col">
                                            {group.permissionKeys.map((key, index) => {
                                                const RowIcon = PERMISSION_ICONS[key];
                                                return (
                                                    <div key={key}>
                                                        {index > 0 && <Separator />}
                                                        <div className="flex items-center justify-between gap-4 py-2.5">
                                                            <div className="flex items-start gap-2.5 min-w-0">
                                                                <RowIcon size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                                                        {t(`label.${key}`)}
                                                                        {COMING_SOON.has(key) && (
                                                                            <Chip size="sm" color="warning" variant="soft">
                                                                                {t("comingSoon")}
                                                                            </Chip>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">{t(`help.${key}`)}</span>
                                                                </div>
                                                            </div>
                                                            <Switch
                                                                isSelected={value[key] === true}
                                                                onChange={next => onChange({ ...value, [key]: next })}
                                                                className="shrink-0"
                                                            >
                                                                <Switch.Control>
                                                                    <Switch.Thumb />
                                                                </Switch.Control>
                                                            </Switch>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </Disclosure.Body>
                                    </Disclosure.Content>
                                </Disclosure>
                            );
                        })}
                    </DisclosureGroup>
                </div>
            )}
        </div>
    );
}
