exports.up = async (pgm) => {
    await pgm.db.query(`
        -- The original wording ("How was your workout?") read like it was
        -- asking about the coach's plan/programming. This prompt is actually
        -- product feedback for us (the app), not the coach — reword to make
        -- that obvious.
        UPDATE insight_prompts
        SET question_en = 'How was your experience using the app?',
            question_ar = 'كيف كانت تجربتك في استخدام التطبيق؟'
        WHERE id = 'sysprompt_post_session_feedback';
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        UPDATE insight_prompts
        SET question_en = 'How was your workout?',
            question_ar = 'كيف كان تمرينك؟'
        WHERE id = 'sysprompt_post_session_feedback';
    `);
};
