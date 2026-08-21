// Short, human-typeable reference code for the manual-transfer payment method (InstaPay /
// mobile wallet, confirmed by an admin over WhatsApp within 24h — no gateway involved, so
// there's no order/invoice id to hand the coach instead). Nullable — only manual-method
// payments get one; Paymob payments already have gateway_reference_id for that role.
exports.up = (pgm) => {
    pgm.addColumn('workspace_payments', {
        reference_code: { type: 'text' },
    });

    // A plain unique index still allows any number of NULL rows (Postgres treats each NULL
    // as distinct), so Paymob payments — which never set this column — aren't affected.
    pgm.createIndex('workspace_payments', 'reference_code', { unique: true });
};

exports.down = (pgm) => {
    pgm.dropColumn('workspace_payments', 'reference_code');
};
