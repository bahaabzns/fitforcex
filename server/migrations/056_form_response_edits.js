// Lets a client edit an already-submitted form answer, with a per-question
// edit trail visible to both the client and the coach. form_responses stays
// the current-value source of truth (and what metric charts read live);
// form_response_edits is pure history — one row per edit.
exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS form_response_edits (
            id                  TEXT PRIMARY KEY,
            response_id         TEXT NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
            previous_answer     TEXT,
            new_answer          TEXT,
            edited_at           TIMESTAMPTZ DEFAULT NOW(),
            edited_by_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_form_response_edits_response ON form_response_edits (response_id, edited_at);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS form_response_edits;
    `);
};
