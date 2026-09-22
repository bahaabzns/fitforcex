exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Phase 4 — Research Platform. Scheduling window + a soft cap on how
        -- often one user can be shown a prompt (funnel-driven frequency
        -- capping, not a separate "seen" table — see insight_prompt_impressions
        -- below).
        ALTER TABLE insight_prompts ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
        ALTER TABLE insight_prompts ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
        ALTER TABLE insight_prompts ADD COLUMN IF NOT EXISTS max_shows_per_user INTEGER;

        -- Multi-workspace targeting. A prompt with zero rows here keeps its
        -- existing single-workspace_id-or-platform-wide behavior (051/052);
        -- rows here narrow it to exactly this set of workspaces, letting an
        -- admin target "specific workspaces" (plural) without a breaking
        -- migration of the original column.
        CREATE TABLE IF NOT EXISTS insight_prompt_workspaces (
            id           TEXT PRIMARY KEY,
            prompt_id    TEXT NOT NULL REFERENCES insight_prompts(id) ON DELETE CASCADE,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_insight_prompt_workspaces_unique ON insight_prompt_workspaces (prompt_id, workspace_id);

        -- Bounded "users matching conditions" targeting — deliberately not a
        -- generic rule engine. field/operator/value against the two client
        -- attributes that are actually filterable today (subscription_status,
        -- current_package_variation_id — see the codebase audit in the
        -- architecture memo's competitive-analysis section). All rows for a
        -- prompt are AND-ed together.
        CREATE TABLE IF NOT EXISTS insight_prompt_conditions (
            id         TEXT PRIMARY KEY,
            prompt_id  TEXT NOT NULL REFERENCES insight_prompts(id) ON DELETE CASCADE,
            field      TEXT NOT NULL,   -- 'subscription_status' | 'package_variation_id'
            operator   TEXT NOT NULL DEFAULT 'eq',
            value      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_insight_prompt_conditions_prompt ON insight_prompt_conditions (prompt_id);

        -- The funnel: sent/viewed (one moment, recorded together — this
        -- system has no separate push channel, a prompt is "sent" exactly
        -- when it's fetched), started, and completed (read from the existing
        -- insights table by prompt_id + submitter, not duplicated here).
        CREATE TABLE IF NOT EXISTS insight_prompt_impressions (
            id                 TEXT PRIMARY KEY,
            prompt_id          TEXT NOT NULL REFERENCES insight_prompts(id) ON DELETE CASCADE,
            submitted_by_type  TEXT NOT NULL,
            submitted_by_id    TEXT NOT NULL,
            viewed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at         TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_insight_prompt_impressions_prompt ON insight_prompt_impressions (prompt_id);
        CREATE INDEX IF NOT EXISTS idx_insight_prompt_impressions_lookup ON insight_prompt_impressions (prompt_id, submitted_by_type, submitted_by_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS insight_prompt_impressions;
        DROP TABLE IF EXISTS insight_prompt_conditions;
        DROP TABLE IF EXISTS insight_prompt_workspaces;
        ALTER TABLE insight_prompts DROP COLUMN IF EXISTS max_shows_per_user;
        ALTER TABLE insight_prompts DROP COLUMN IF EXISTS ends_at;
        ALTER TABLE insight_prompts DROP COLUMN IF EXISTS starts_at;
    `);
};
