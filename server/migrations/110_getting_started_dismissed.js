// Getting-started checklist: remembers that the owner hid it, so it never comes back for that workspace.
//
// Touches exactly:
//   workspaces.getting_started_dismissed_at (new)
exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "getting_started_dismissed_at" TIMESTAMPTZ;`);
};

exports.down = (pgm) => {
    pgm.sql(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "getting_started_dismissed_at";`);
};
