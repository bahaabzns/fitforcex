"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";

// A check-in form is "compatible" with a plan type when its own
// post-submission action targets that plan type -- the same form metadata
// the coach already sets in the Forms builder (After Submission Action),
// not a hardcoded name/title match. Package defaults are always included
// and pre-checked regardless of this filter (trust the package's own
// configuration over the form's post_action, in case the two ever drift).
function isCompatibleCheckInForm(form, planType) {
    if (form.form_type !== "check-in" || form.status === "archived") return false;
    return form.post_action === (planType === "training" ? "workout-plan" : "nutrition-plan");
}

/**
 * Package Lifecycle Phase 3b — fires before a plan is activated. Pre-fills
 * Plan Duration and Check-in Forms from the client's resolved package
 * variation (GET /:clientId/package-defaults); the coach can accept, edit,
 * or clear either before confirming. This modal's confirmation is what
 * actually triggers activation (onConfirm) — it does not activate anything
 * itself. Deliberately separate from the existing submission-linked "Mark as
 * Done" modal (AD-3): different trigger, different consequence.
 *
 * Post-review refinement: the Check-in Forms list now shows every
 * plan-type-compatible check-in form in the workspace, not just the
 * package's defaults -- package defaults are pre-selected, everything else
 * compatible is offered unselected, and incompatible forms (assessments,
 * the other plan type's check-ins) never appear at all.
 */
export default function ConfigureActivationModal({ open, onClose, clientId, planType, onConfirm, confirming, titleKey = "title" }) {
    const t = useTranslations("planActivation");
    const [loading, setLoading] = useState(true);
    const [cycleDays, setCycleDays] = useState("");
    const [checkInForms, setCheckInForms] = useState([]); // [{ formId, titleEn, titleAr, checked, isPackageDefault }]
    // Not surfaced as an editable field (the vision only asks for Duration +
    // Check-in Forms) -- just carried through silently so the daily
    // review-due check has a snapshotted value to read (Phase 4).
    const [reviewOffsetDays, setReviewOffsetDays] = useState(null);

    useEffect(() => {
        if (!open || !clientId) return;
        let active = true;
        setLoading(true);
        Promise.all([
            api.get(`/api/clients/${clientId}/package-defaults`),
            api.get(`/api/forms`),
        ])
            .then(([{ data }, { data: allForms }]) => {
                if (!active) return;
                const days = planType === "training" ? data?.trainingCycleDays : data?.nutritionCycleDays;
                setCycleDays(days != null ? String(days) : "");
                setReviewOffsetDays(data?.reviewOffsetDays ?? null);

                const defaults = data?.checkInForms ?? [];
                const defaultIds = new Set(defaults.map(f => f.formId));
                const compatible = (allForms ?? [])
                    .filter(f => isCompatibleCheckInForm(f, planType) && !defaultIds.has(f.id))
                    .map(f => ({ formId: f.id, titleEn: f.title_en, titleAr: f.title_ar, checked: false, isPackageDefault: false }));

                setCheckInForms([
                    ...defaults.map(f => ({ ...f, checked: true, isPackageDefault: true })),
                    ...compatible,
                ]);
            })
            .catch(() => { if (active) { setCycleDays(""); setCheckInForms([]); setReviewOffsetDays(null); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [open, clientId, planType]);

    function toggleForm(formId) {
        setCheckInForms(prev => prev.map(f => f.formId === formId ? { ...f, checked: !f.checked } : f));
    }

    function handleConfirm() {
        const resolvedCycleDays = cycleDays ? Number(cycleDays) : null;
        const resolvedCheckInForms = checkInForms
            .filter(f => f.checked)
            .map(f => ({ formId: f.formId }));
        onConfirm({ cycleDays: resolvedCycleDays, checkInForms: resolvedCheckInForms, reviewOffsetDays });
    }

    return (
        <Modal open={open} onClose={onClose} title={t(titleKey)}>
            <div className="flex flex-col gap-5 px-1 py-1">
                {loading ? (
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-10 rounded-lg" />
                        <Skeleton className="h-24 rounded-lg" />
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel>{t("durationLabel")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("durationLabel")} value={cycleDays} onChange={setCycleDays}>
                                <Input type="number" min="1" inputMode="numeric" placeholder={t("durationPlaceholder")} />
                            </TextField>
                            <p className="text-xs text-muted-foreground">{t("durationHint")}</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <FieldLabel>{t("checkInFormsLabel")}</FieldLabel>
                            {checkInForms.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t("noCheckInDefaults")}</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {checkInForms.map(f => (
                                        <div key={f.formId} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                                            <input
                                                type="checkbox"
                                                checked={f.checked}
                                                onChange={() => toggleForm(f.formId)}
                                                className="rounded shrink-0"
                                            />
                                            <span className="text-sm text-foreground flex-1 min-w-0 truncate">{f.titleEn}</span>
                                            {f.isPackageDefault && (
                                                <Chip size="sm" color="secondary" variant="soft" className="shrink-0">
                                                    <Chip.Label>{t("packageDefault")}</Chip.Label>
                                                </Chip>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">{t("checkInFormsHint")}</p>
                        </div>
                    </>
                )}

                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose} isDisabled={confirming}>
                        {t("cancel")}
                    </Button>
                    <Button type="button" variant="primary" onClick={handleConfirm} isDisabled={loading || confirming}>
                        {confirming ? t("activating") : t("confirmAndActivate")}
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
