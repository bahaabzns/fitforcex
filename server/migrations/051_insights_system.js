exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS roadmap_items (
            id            TEXT PRIMARY KEY,
            workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
            title         TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'proposed', -- 'proposed'|'planned'|'in_progress'|'shipped'|'declined'
            release_tag   TEXT,                             -- e.g. 'v1.42' — settable by hand today, by a deploy hook later
            archived_at   TIMESTAMPTZ,
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            resolved_at   TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_roadmap_items_status    ON roadmap_items (status);
        CREATE INDEX IF NOT EXISTS idx_roadmap_items_workspace ON roadmap_items (workspace_id);

        CREATE TABLE IF NOT EXISTS insight_prompts (
            id               TEXT PRIMARY KEY,
            workspace_id     TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- null = platform-wide prompt
            question_en      TEXT NOT NULL,
            question_ar      TEXT,
            response_type    TEXT NOT NULL,                  -- 'rating' | 'multiple_choice' | 'text'
            options          JSONB,                          -- for multiple_choice
            target_audience  TEXT NOT NULL DEFAULT 'everyone', -- 'coach' | 'client' | 'everyone'
            trigger_event    TEXT,                           -- null = shown immediately (Phase 2); set = contextual (Phase 3, not built yet)
            status           TEXT NOT NULL DEFAULT 'active', -- 'active' | 'ended'
            created_by       TEXT NOT NULL,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            ended_at         TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_insight_prompts_status_audience ON insight_prompts (status, target_audience);
        CREATE INDEX IF NOT EXISTS idx_insight_prompts_workspace       ON insight_prompts (workspace_id);

        CREATE TABLE IF NOT EXISTS insights (
            id                 TEXT PRIMARY KEY,
            workspace_id       TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
            source_type        TEXT NOT NULL,                -- 'bug' | 'feature_request' | 'rating' | 'prompt_response'
            prompt_id          TEXT REFERENCES insight_prompts(id) ON DELETE SET NULL,
            submitted_by_type  TEXT NOT NULL,                -- 'coach' | 'client'
            submitted_by_id    TEXT NOT NULL,
            module             TEXT,                         -- e.g. 'nutrition_builder' — origin context
            app_version        TEXT,
            rating_value       INTEGER,
            text_value         TEXT,
            selected_option    TEXT,
            screenshot_url     TEXT,
            status             TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'triaged' | 'resolved'
            roadmap_item_id    TEXT REFERENCES roadmap_items(id) ON DELETE SET NULL,
            resolution_note    TEXT,
            archived_at        TIMESTAMPTZ,
            created_at         TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_insights_workspace_status ON insights (workspace_id, status);
        CREATE INDEX IF NOT EXISTS idx_insights_roadmap_item     ON insights (roadmap_item_id);
        CREATE INDEX IF NOT EXISTS idx_insights_prompt           ON insights (prompt_id);
        CREATE INDEX IF NOT EXISTS idx_insights_created          ON insights (created_at DESC);

        CREATE TABLE IF NOT EXISTS insight_events (
            id           TEXT PRIMARY KEY,
            entity_type  TEXT NOT NULL,   -- 'insight' | 'roadmap_item'
            entity_id    TEXT NOT NULL,
            from_status  TEXT,
            to_status    TEXT NOT NULL,
            note         TEXT,            -- the human "why" behind this transition
            actor_id     TEXT NOT NULL,
            created_at   TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_insight_events_entity ON insight_events (entity_type, entity_id, created_at DESC);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS insight_events;
        DROP TABLE IF EXISTS insights;
        DROP TABLE IF EXISTS insight_prompts;
        DROP TABLE IF EXISTS roadmap_items;
    `);
};
