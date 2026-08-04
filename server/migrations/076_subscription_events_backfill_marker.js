// Distinguishes events written live by applyPayment/applyAddonPurchase/trialSweep/
// updatePayment (is_backfilled = false) from ones reconstructed after the fact by
// scripts/backfill-workspace-subscription-events.ts for payments that predate migration
// 075 (is_backfilled = true) — the backfilled ones are a best-effort approximation
// (replays the OLD always-extend-forward behavior these payments actually ran under,
// since that's what really happened; see the script's own doc comment for exactly what
// it can and can't reconstruct), not a verified historical record like the real ones.
exports.up = (pgm) => {
    pgm.addColumns('workspace_subscription_events', {
        is_backfilled: { type: 'boolean', notNull: true, default: false },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('workspace_subscription_events', ['is_backfilled']);
};
