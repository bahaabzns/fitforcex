exports.up = (pgm) => {
    pgm.addColumns('plans', {
        subtitle:           { type: 'text',    notNull: false, default: null },
        is_popular:         { type: 'boolean', notNull: true,  default: false },
        cta_text:           { type: 'text',    notNull: true,  default: 'Get Started' },
        cta_variant:        { type: 'text',    notNull: true,  default: 'outline' },
        features_header:    { type: 'text',    notNull: true,  default: "What's included:" },
        features_subheader: { type: 'text',    notNull: false, default: null },
        has_team_counter:   { type: 'boolean', notNull: true,  default: false },
        sort_order:         { type: 'integer', notNull: true,  default: 0 },
        currency:           { type: 'text',    notNull: true,  default: 'LE' },
        show_on_landing:    { type: 'boolean', notNull: true,  default: true },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('plans', [
        'subtitle', 'is_popular', 'cta_text', 'cta_variant',
        'features_header', 'features_subheader', 'has_team_counter',
        'sort_order', 'currency', 'show_on_landing',
    ]);
};
