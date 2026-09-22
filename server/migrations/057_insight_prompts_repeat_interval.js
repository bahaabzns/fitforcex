exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Founder Prompts: recurring pulse. NULL preserves the existing ask-once-ever
        -- behavior for every prior prompt; setting this (e.g. 14 for bi-weekly) lets
        -- getActivePrompt re-show a manual prompt once a past response is older than
        -- this many days, instead of excluding the submitter forever.
        ALTER TABLE insight_prompts ADD COLUMN IF NOT EXISTS repeat_interval_days INTEGER;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`ALTER TABLE insight_prompts DROP COLUMN IF EXISTS repeat_interval_days;`);
};
