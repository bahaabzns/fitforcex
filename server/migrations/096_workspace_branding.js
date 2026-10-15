// Custom Branding: per-plan capabilities + per-workspace portal branding + banners.
// Branding is intentionally NOT stored on nutrition_pdf_settings / training_pdf_settings
// (those are independent PDF profiles — see migration 091). Image columns hold storage
// KEYS, mapped to public URLs at read time, so an S3_PUBLIC_URL change never strands data.
exports.up = (pgm) => {
    pgm.sql(`
        ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "capabilities" JSONB NOT NULL DEFAULT '{}'::jsonb;

        CREATE TABLE IF NOT EXISTS "workspace_branding" (
            "workspace_id"  TEXT PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "logo_key"      TEXT,
            "logo_dark_key" TEXT,
            "primary_color" CHAR(7),
            "accent_color"  CHAR(7),
            "version"       INTEGER NOT NULL DEFAULT 1,
            "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_by"    TEXT,
            CONSTRAINT "workspace_branding_primary_hex" CHECK ("primary_color" IS NULL OR "primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
            CONSTRAINT "workspace_branding_accent_hex"  CHECK ("accent_color"  IS NULL OR "accent_color"  ~ '^#[0-9A-Fa-f]{6}$')
        );

        CREATE TABLE IF NOT EXISTS "workspace_banners" (
            "id"           TEXT PRIMARY KEY,
            "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "image_key"    TEXT NOT NULL,
            "title"        VARCHAR(80),
            "link_url"     VARCHAR(500),
            "sort_order"   INTEGER NOT NULL DEFAULT 0,
            "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
            "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at"   TIMESTAMPTZ(6)
        );
        CREATE INDEX IF NOT EXISTS "workspace_banners_ws_order_idx"
            ON "workspace_banners"("workspace_id", "sort_order") WHERE "deleted_at" IS NULL;
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        DROP TABLE IF EXISTS "workspace_banners";
        DROP TABLE IF EXISTS "workspace_branding";
        ALTER TABLE "plans" DROP COLUMN IF EXISTS "capabilities";
    `);
};
