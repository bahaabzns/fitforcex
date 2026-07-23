// plans.price_monthly is nullable today (renders as "Custom pricing" on the landing page
// for an enterprise-style tier with no listed price). plan_variations should preserve that
// same capability rather than forcing every variation to carry a price.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE plan_variations ALTER COLUMN price_monthly DROP NOT NULL;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE plan_variations ALTER COLUMN price_monthly SET NOT NULL;
    `);
};
