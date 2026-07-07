// A check-in form is "compatible" with a plan type when its own
// post-submission action targets that plan type -- the same form metadata
// the coach already sets in the Forms builder (After Submission Action),
// not a hardcoded name/title match. Shared by ConfigureActivationModal (plan
// activation) and the Packages page (Package Variation default check-in
// pickers) so the rule can't drift between the two surfaces.
export function isCompatibleCheckInForm(form, planType) {
    if (form.form_type !== "check-in" || form.status === "archived") return false;
    return form.post_action === (planType === "training" ? "workout-plan" : "nutrition-plan");
}
