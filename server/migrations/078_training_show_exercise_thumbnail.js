// Lets a coach hide/show the exercise-library thumbnail image (with a
// play-button overlay when the exercise also has a video) next to each
// exercise in exported training plan PDFs. Training-only — nutrition has no
// equivalent per-food thumbnail today.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_pdf_settings ADD COLUMN show_exercise_thumbnail BOOLEAN NOT NULL DEFAULT TRUE;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_pdf_settings DROP COLUMN show_exercise_thumbnail;
    `);
};
