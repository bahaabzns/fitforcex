"use client";

import { useTranslations } from "next-intl";
import { FieldLabel } from "@/app/components/Field";

/**
 * Package Lifecycle — default restart/extend behavior for a package variation.
 * Two-option segmented control; mirrors the pill-button pattern already used
 * for timeframe presets elsewhere in the app rather than introducing a new
 * control shape.
 */
export default function PlanUpdateModeToggle({ value, onChange }) {
    const t = useTranslations("packages");
    const mode = value || "extend";

    return (
        <div className="flex flex-col gap-1.5">
            <FieldLabel>{t("planUpdateModeLabel")}</FieldLabel>
            <div className="inline-flex rounded-lg border border-border p-0.5 w-fit">
                {["extend", "restart"].map(option => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        className={`cursor-pointer px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            mode === option
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {option === "extend" ? t("planUpdateModeExtend") : t("planUpdateModeRestart")}
                    </button>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("planUpdateModeHint")}</p>
        </div>
    );
}
