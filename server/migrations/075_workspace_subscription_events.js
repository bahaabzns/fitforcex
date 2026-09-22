// Append-only subscription history (audit finding D1 / refactoring opportunity #6): every
// write to workspace_subscriptions that changes its period records the ACTUAL resulting
// starts_at/expires_at here, tied back to whichever payment (if any) caused it. The admin
// payments page joins against this instead of guessing a period from paid_at + duration_days,
// which disagrees with reality for renewals and admin overrides (see billing.controller.ts's
// applyPayment/applyAddonPurchase, admin.controller.ts's updatePayment resync block, and
// lib/trialSweep.ts — the six places that now write here).
exports.up = (pgm) => {
    pgm.createTable('workspace_subscription_events', {
        id:                   { type: 'text', primaryKey: true },
        workspace_id:         { type: 'text', notNull: true, references: 'workspaces', onDelete: 'CASCADE' },
        payment_id:           { type: 'text', references: 'workspace_payments', onDelete: 'SET NULL' },
        event_type:           { type: 'text', notNull: true },
        plan_id:              { type: 'text' },
        variation_id:         { type: 'text' },
        locked_price_monthly: { type: 'decimal(10,2)' },
        locked_currency:      { type: 'text' },
        starts_at:            { type: 'timestamptz' },
        expires_at:           { type: 'timestamptz' },
        previous_expires_at:  { type: 'timestamptz' },
        actor_type:           { type: 'text', notNull: true },
        actor_label:          { type: 'text' },
        created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('workspace_subscription_events', ['workspace_id', 'created_at']);
    pgm.createIndex('workspace_subscription_events', 'payment_id');
};

exports.down = (pgm) => {
    pgm.dropTable('workspace_subscription_events');
};
