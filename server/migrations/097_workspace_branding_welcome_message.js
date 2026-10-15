// Optional short greeting shown to trainees on the portal login page and home.
exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE "workspace_branding" ADD COLUMN IF NOT EXISTS "welcome_message" VARCHAR(160);`);
};

exports.down = (pgm) => {
    pgm.sql(`ALTER TABLE "workspace_branding" DROP COLUMN IF EXISTS "welcome_message";`);
};
