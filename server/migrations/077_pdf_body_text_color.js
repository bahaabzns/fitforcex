// A single configurable color for all "regular" PDF text (table cells,
// notes, footer, badges) — everything that isn't a heading (primary_color)
// or a table header (header_text_color). Needed once a coach can set a dark
// page background (see migration for page_bg_image_url exposure): the
// previously-hardcoded near-black body text and gray notes/footer become
// unreadable against a dark image, with no way to fix it. Default matches
// today's hardcoded body color exactly, so no existing export changes look
// until a coach opts in.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_pdf_settings ADD COLUMN body_text_color TEXT NOT NULL DEFAULT '#1A1A1A';
        ALTER TABLE training_pdf_settings  ADD COLUMN body_text_color TEXT NOT NULL DEFAULT '#1A1A1A';
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_pdf_settings DROP COLUMN body_text_color;
        ALTER TABLE training_pdf_settings  DROP COLUMN body_text_color;
    `);
};
