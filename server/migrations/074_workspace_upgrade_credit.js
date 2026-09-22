// Workspace subscription tier changes (plan/variation upgrades) now credit whatever
// value is left, unused, on the old subscription — see billing.controller.ts's
// computeRemainingCreditValue, createInvoice, and applyPayment. This column records
// how much of a self-serve invoice's amount was covered by that credit, for admin/
// coach-facing transparency on the payment ledger.
exports.up = (pgm) => {
    pgm.addColumns('workspace_payments', {
        credit_applied: { type: 'decimal(10,2)' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('workspace_payments', ['credit_applied']);
};
