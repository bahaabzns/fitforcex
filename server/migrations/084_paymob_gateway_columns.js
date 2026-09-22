// Payment gateway swap: Fawaterak → Paymob (see docs/billing-architecture-audit.md
// for why the old static-payment-link Fawaterak design was being replaced). Paymob
// has no equivalent per-plan static link — every checkout creates a real order for
// the actual computed amount — so these columns are renamed to gateway-neutral
// names rather than kept vendor-specific, and a new payment_method column is added
// since Paymob uses a different integration (Card vs. Wallet) per checkout.
exports.up = (pgm) => {
    pgm.renameColumn('workspace_payments', 'fawaterak_invoice_id',  'gateway_reference_id');
    pgm.renameColumn('workspace_payments', 'fawaterak_payment_url', 'gateway_payment_url');
    pgm.renameColumn('workspace_payments', 'fawaterak_status',      'gateway_status');
    pgm.renameColumn('workspace_payments', 'fawaterak_raw_webhook', 'gateway_raw_webhook');

    pgm.addColumn('workspace_payments', {
        payment_method: {
            type: 'text',
            notNull: true,
            default: 'card',
            // allowed values: 'card' | 'wallet'
        },
    });

    // Note: the index created in migration 003 on the old fawaterak_invoice_id column
    // keeps working after the rename above (Postgres tracks index columns by internal
    // attribute number, not name) — it just keeps its old auto-generated name
    // (workspace_payments_fawaterak_invoice_id_index) rather than a cosmetic mismatch
    // worth a drop/recreate here.
};

exports.down = (pgm) => {
    pgm.dropColumn('workspace_payments', 'payment_method');

    pgm.renameColumn('workspace_payments', 'gateway_raw_webhook', 'fawaterak_raw_webhook');
    pgm.renameColumn('workspace_payments', 'gateway_status',      'fawaterak_status');
    pgm.renameColumn('workspace_payments', 'gateway_payment_url', 'fawaterak_payment_url');
    pgm.renameColumn('workspace_payments', 'gateway_reference_id', 'fawaterak_invoice_id');
};
