// "What's new" announcements shown as a single dismissible card on the coach dashboard,
// managed from the Admin panel. Per-user dismissal state lives in the DB (not localStorage)
// so a dismissal follows the coach across devices.
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "product_announcements" (
            "id"          TEXT PRIMARY KEY,
            "title"       VARCHAR(120) NOT NULL,
            "title_ar"    VARCHAR(120),
            "body"        VARCHAR(280) NOT NULL,
            "body_ar"     VARCHAR(280),
            "cta_label"   VARCHAR(40),
            "cta_label_ar" VARCHAR(40),
            "cta_href"    VARCHAR(300),
            "image_key"   TEXT,
            "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
            "starts_at"   TIMESTAMPTZ(6),
            "ends_at"     TIMESTAMPTZ(6),
            "sort_order"  INTEGER NOT NULL DEFAULT 0,
            "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "product_announcements_active_idx"
            ON "product_announcements"("is_active", "sort_order");

        CREATE TABLE IF NOT EXISTS "announcement_dismissals" (
            "user_id"         TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "announcement_id" TEXT NOT NULL REFERENCES "product_announcements"("id") ON DELETE CASCADE,
            "action"          VARCHAR(12) NOT NULL DEFAULT 'dismissed',
            "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("user_id", "announcement_id"),
            CONSTRAINT "announcement_dismissals_action_check" CHECK ("action" IN ('dismissed', 'clicked'))
        );

        INSERT INTO "product_announcements"
            ("id", "title", "title_ar", "body", "body_ar", "cta_label", "cta_label_ar", "cta_href", "sort_order")
        VALUES (
            'announcement_custom_branding',
            'Make the client portal yours',
            'اجعل بوابة العملاء بهويتك',
            'Add your logo, colors and banners so your trainees see your brand.',
            'أضف شعارك وألوانك وبانراتك ليرى متدربوك هويتك التجارية.',
            'Set up branding',
            'إعداد الهوية البصرية',
            '/{slug}/settings/branding',
            0
        )
        ON CONFLICT ("id") DO NOTHING;
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        DROP TABLE IF EXISTS "announcement_dismissals";
        DROP TABLE IF EXISTS "product_announcements";
    `);
};
