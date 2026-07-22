exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Phase 4 — "multiple concurrent prompts." Default false preserves
        -- Phase 2's "one active question at a time" behavior for every
        -- existing/typical prompt; an admin opts a specific campaign into
        -- running alongside others by setting this true at creation.
        ALTER TABLE insight_prompts ADD COLUMN IF NOT EXISTS allow_concurrent BOOLEAN NOT NULL DEFAULT false;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`ALTER TABLE insight_prompts DROP COLUMN IF EXISTS allow_concurrent;`);
};
