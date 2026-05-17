exports.up = (pgm) => {
    // Add duration_days to plans so each plan knows how many days it grants on payment
    pgm.addColumn('plans', {
        duration_days: {
            type: 'integer',
            notNull: true,
            default: 30,
        },
    });

    // workspace_payments: one row per payment attempt a coach makes
    pgm.createTable('workspace_payments', {
        id: { type: 'serial', primaryKey: true },

        workspace_id: {
            type: 'integer',
            notNull: true,
            references: 'workspaces(id)',
            onDelete: 'CASCADE',
        },

        plan_id: {
            type: 'integer',
            notNull: true,
            references: 'plans(id)',
        },

        amount: {
            type: 'numeric(10,2)',
            notNull: true,
        },

        currency: {
            type: 'text',
            notNull: true,
            default: 'EGP',
        },

        duration_days: {
            type: 'integer',
            notNull: true,
        },

        fawaterak_invoice_id:  { type: 'text' },
        fawaterak_payment_url: { type: 'text' },

        fawaterak_status: {
            type: 'text',
            notNull: true,
            default: 'pending',
            // allowed values: 'pending' | 'paid' | 'failed' | 'refunded'
        },

        // Full raw webhook payload stored for audit/dispute purposes
        fawaterak_raw_webhook: { type: 'jsonb' },

        notes: { type: 'text' },

        paid_at:    { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.createIndex('workspace_payments', 'fawaterak_invoice_id');
    pgm.createIndex('workspace_payments', 'workspace_id');
};

exports.down = (pgm) => {
    pgm.dropTable('workspace_payments');
    pgm.dropColumn('plans', 'duration_days');
};
