/**
 * Add a human-friendly, per-workspace sequential transaction code.
 *
 * The primary key stays a cuid; transaction_code is what the UI shows (#0001…).
 * Existing rows are backfilled in creation order, restarting per workspace.
 */

exports.up = (pgm) => {
    pgm.addColumns('transactions', {
        transaction_code: { type: 'integer', notNull: false },
    });

    // Backfill: number each workspace's transactions 1..N ordered by creation.
    pgm.sql(`
        UPDATE transactions t
        SET transaction_code = s.rn
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at ASC, id ASC) AS rn
            FROM transactions
        ) s
        WHERE t.id = s.id;
    `);

    pgm.alterColumn('transactions', 'transaction_code', { notNull: true });
    pgm.addConstraint('transactions', 'transactions_workspace_code_key', {
        unique: ['workspace_id', 'transaction_code'],
    });
};

exports.down = (pgm) => {
    pgm.dropConstraint('transactions', 'transactions_workspace_code_key');
    pgm.dropColumns('transactions', ['transaction_code']);
};
