// Lets a coach pick a preset size (small/medium/large) for the exercise
// thumbnail added by migration 078, instead of always rendering it at one
// fixed size. Kept as a free-text column (validated by the Zod enum in
// pdfExport.controller.ts, same as every other enum-like setting in this
// app) rather than a DB CHECK constraint, matching the rest of this table.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_pdf_settings ADD COLUMN exercise_thumbnail_size TEXT NOT NULL DEFAULT 'medium';
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_pdf_settings DROP COLUMN exercise_thumbnail_size;
    `);
};
