exports.up = (pgm) => {
    pgm.createTable('billing_discounts', {
        id:               { type: 'serial',  primaryKey: true },
        period_key:       { type: 'text',    notNull: true, unique: true },
        label:            { type: 'text',    notNull: true },
        save_label:       { type: 'text',    notNull: false, default: null },
        discount_percent: { type: 'integer', notNull: true, default: 0 },
        months:           { type: 'integer', notNull: true, default: 1 },
        sort_order:       { type: 'integer', notNull: true, default: 0 },
        is_active:        { type: 'boolean', notNull: true, default: true },
    });

    pgm.addColumns('plans', {
        price_per_seat: { type: 'decimal(10,2)', notNull: false, default: null },
        min_seat_count: { type: 'integer', notNull: true, default: 1 },
        max_seat_count: { type: 'integer', notNull: true, default: 20 },
    });
};

exports.down = (pgm) => {
    pgm.dropTable('billing_discounts');
    pgm.dropColumns('plans', ['price_per_seat', 'min_seat_count', 'max_seat_count']);
};
