exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Configurable rating scale (e.g. 5 instead of the default 10). NULL
        -- preserves every existing prompt's current 1-10 behavior — see
        -- respondToPromptShared / getPromptFunnel in insights.controller.ts
        -- and insights.service.ts.
        ALTER TABLE insight_prompts ADD COLUMN IF NOT EXISTS scale_max INTEGER;
    `);

    await pgm.db.query(`
        -- Seeds the single "Post-Session Feedback" prompt shown inline on the
        -- Training Mode completion page after every finished session. Uses a
        -- reserved trigger_event marker ('workout_session_finished') that is
        -- deliberately NOT part of the TRIGGER_EVENTS catalog in
        -- insights.service.ts, so it can never surface through the generic
        -- /prompts/for-trigger/:event route or the site-wide manual
        -- InsightBanner (which only considers trigger_event IS NULL rows) —
        -- it's reached only via the dedicated getPostSessionPrompt lookup.
        INSERT INTO insight_prompts (
            id, workspace_id, question_en, question_ar, response_type,
            target_audience, trigger_event, status, created_by, scale_max
        ) VALUES (
            'sysprompt_post_session_feedback',
            NULL,
            'How was your workout?',
            'كيف كان تمرينك؟',
            'rating_with_text',
            'client',
            'workout_session_finished',
            'active',
            'system',
            5
        )
        ON CONFLICT (id) DO NOTHING;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`DELETE FROM insight_prompts WHERE id = 'sysprompt_post_session_feedback';`);
    await pgm.db.query(`ALTER TABLE insight_prompts DROP COLUMN IF EXISTS scale_max;`);
};
