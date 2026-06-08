exports.up = (pgm) => {
    pgm.createTable('plan_period_links', {
        id: { type: 'text', primaryKey: true },
        plan_id: {
            type: 'text',
            notNull: true,
            references: 'plans(id)',
            onDelete: 'CASCADE',
        },
        billing_discount_id: {
            type: 'text',
            notNull: true,
            references: 'billing_discounts(id)',
            onDelete: 'CASCADE',
        },
        payment_link: { type: 'text', notNull: false, default: null },
    });

    pgm.addConstraint('plan_period_links', 'plan_period_links_unique', 'UNIQUE(plan_id, billing_discount_id)');
};

exports.down = (pgm) => {
    pgm.dropTable('plan_period_links');
};
