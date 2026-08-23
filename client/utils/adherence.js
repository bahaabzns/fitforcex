// Shared thresholds for coloring an adherence percentage — a client and
// their coach must read the same percentage as the same color, and every
// adherence surface (diary history, the nutrition builder's plan badge, the
// Food Diary modal) reuses this instead of redefining its own. Adherence is
// capped at 100 server-side (foodDiaryStats.ts) -- eating past a goal is
// still fully adherent, not "over" -- so only the low end needs a tier.
// Mirrored in mobile's shared/utils/adherence.dart -- no shared package
// across web/mobile exists in this repo, so keep both in sync.
const ADHERENCE_GOOD_THRESHOLD = 85;
const ADHERENCE_WARNING_THRESHOLD = 60;

export function adherenceColor(pct) {
    if (pct === null || pct === undefined) return "text-muted-foreground";
    if (pct >= ADHERENCE_GOOD_THRESHOLD) return "text-emerald-500";
    if (pct >= ADHERENCE_WARNING_THRESHOLD) return "text-amber-500";
    return "text-destructive";
}

// Same tiers, expressed as a HeroUI Chip `color` value.
export function adherenceChipColor(pct) {
    if (pct === null || pct === undefined) return "default";
    if (pct >= ADHERENCE_GOOD_THRESHOLD) return "success";
    if (pct >= ADHERENCE_WARNING_THRESHOLD) return "warning";
    return "danger";
}
