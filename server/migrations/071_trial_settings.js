// Founder decision: the trial is admin-controlled (on/off + duration), global — not a
// per-plan `trial_days` value. A single-row settings table (fixed id) is simplest for a
// pair of global toggles; when enabled, new workspaces start on the OneForce trial variation
// instead of Free (see auth.controller.ts), and an expiry sweep moves them to Free afterward.
exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE trial_settings (
            id                  TEXT    PRIMARY KEY DEFAULT 'singleton',
            trial_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
            trial_duration_days INTEGER NOT NULL DEFAULT 14,
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            CONSTRAINT trial_settings_singleton CHECK (id = 'singleton')
        );

        INSERT INTO trial_settings (id) VALUES ('singleton');
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`DROP TABLE IF EXISTS trial_settings;`);
};
