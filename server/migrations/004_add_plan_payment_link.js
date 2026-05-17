exports.up = (pgm) => {
    pgm.addColumn('plans', {
        payment_link: { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('plans', 'payment_link');
};
