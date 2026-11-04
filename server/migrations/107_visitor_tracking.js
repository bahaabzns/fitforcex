// Anonymous visitor tracking for the admin "Conversions" page.
// A browser gets a random id on its first public-page visit; each visit burst is bucketed into a
// session; at signup the id is stamped on the new workspace so the pre-signup history is linked.
// Existing workspaces get NULL, which the admin page renders as "unknown".
//
// Touches exactly:
//   visitors          (new)  one row per anonymous browser — first-touch source lives here
//   visitor_sessions  (new)  one row per visit session (30 min inactivity = new session)
//   workspaces.visitor_id    text NULL REFERENCES visitors(id) ON DELETE SET NULL
//   index workspaces_visitor_id_idx
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "visitors" (
            "id"                 TEXT PRIMARY KEY,
            "first_seen_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
            "last_seen_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
            "first_referrer"     TEXT,
            "first_utm_source"   TEXT,
            "first_utm_medium"   TEXT,
            "first_utm_campaign" TEXT,
            "first_fbclid"       BOOLEAN NOT NULL DEFAULT FALSE,
            "first_landing_path" TEXT,
            "first_source"       TEXT NOT NULL DEFAULT 'direct',
            "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
            "deleted_at"         TIMESTAMPTZ
        );
    `);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "visitors_first_seen_at_idx" ON "visitors" ("first_seen_at");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "visitors_deleted_at_idx" ON "visitors" ("deleted_at");`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "visitor_sessions" (
            "id"           TEXT PRIMARY KEY,
            "visitor_id"   TEXT NOT NULL REFERENCES "visitors"("id") ON DELETE CASCADE,
            "started_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
            "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "page_count"   INTEGER NOT NULL DEFAULT 1,
            "landing_path" TEXT,
            "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
            "deleted_at"   TIMESTAMPTZ
        );
    `);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "visitor_sessions_visitor_started_idx" ON "visitor_sessions" ("visitor_id", "started_at");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "visitor_sessions_deleted_at_idx" ON "visitor_sessions" ("deleted_at");`);

    pgm.sql(`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "visitor_id" TEXT REFERENCES "visitors"("id") ON DELETE SET NULL;`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "workspaces_visitor_id_idx" ON "workspaces" ("visitor_id");`);
};

exports.down = (pgm) => {
    pgm.sql(`DROP INDEX IF EXISTS "workspaces_visitor_id_idx";`);
    pgm.sql(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "visitor_id";`);
    pgm.sql(`DROP TABLE IF EXISTS "visitor_sessions";`);
    pgm.sql(`DROP TABLE IF EXISTS "visitors";`);
};
