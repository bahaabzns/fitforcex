// Lets a coach independently hide/show each text element on the PDF cover
// page (header, title, subtitle, "Prepared for {client}") without deleting
// the underlying text — e.g. keep a subtitle typed but hidden for now.
// Added to both nutrition_pdf_settings and training_pdf_settings since the
// cover page layout is shared structure between the two (see DECISIONS.md,
// 2026-07-28 split), even though the two tables are otherwise independent.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_pdf_settings
            ADD COLUMN show_cover_header      BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_cover_title       BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_cover_subtitle    BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_cover_client_name BOOLEAN NOT NULL DEFAULT TRUE;

        ALTER TABLE training_pdf_settings
            ADD COLUMN show_cover_header      BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_cover_title       BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_cover_subtitle    BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_cover_client_name BOOLEAN NOT NULL DEFAULT TRUE;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_pdf_settings
            DROP COLUMN show_cover_header,
            DROP COLUMN show_cover_title,
            DROP COLUMN show_cover_subtitle,
            DROP COLUMN show_cover_client_name;

        ALTER TABLE training_pdf_settings
            DROP COLUMN show_cover_header,
            DROP COLUMN show_cover_title,
            DROP COLUMN show_cover_subtitle,
            DROP COLUMN show_cover_client_name;
    `);
};
