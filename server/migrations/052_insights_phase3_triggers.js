exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Phase 3 — Contextual Triggers. insight_prompts.trigger_event already
        -- existed (nullable, unused) since 051; this table is the only new
        -- storage Phase 3 needs: a persistent "seen, didn't answer" record so
        -- a contextual prompt (e.g. fired after every workout) doesn't nag the
        -- same user repeatedly. Manual (trigger_event IS NULL) prompts don't
        -- consult this table — their dismiss stays session-only by design.
        CREATE TABLE IF NOT EXISTS insight_prompt_dismissals (
            id                 TEXT PRIMARY KEY,
            prompt_id          TEXT NOT NULL REFERENCES insight_prompts(id) ON DELETE CASCADE,
            submitted_by_type  TEXT NOT NULL,
            submitted_by_id    TEXT NOT NULL,
            dismissed_at       TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_insight_prompt_dismissals_lookup
            ON insight_prompt_dismissals (prompt_id, submitted_by_type, submitted_by_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`DROP TABLE IF EXISTS insight_prompt_dismissals;`);
};
