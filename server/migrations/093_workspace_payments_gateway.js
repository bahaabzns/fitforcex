// Records which gateway created each payment, so webhooks/status polling route to the right
// one after PAYMENT_GATEWAY is switched. NULL = legacy row (Paymob, or manual — manual rows
// never reach a gateway, so the value is irrelevant there).
exports.up = (pgm) => {
    pgm.addColumn('workspace_payments', {
        gateway: { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('workspace_payments', 'gateway');
};
