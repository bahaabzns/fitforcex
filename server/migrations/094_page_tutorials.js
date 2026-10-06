// page_tutorials was only ever added as a Prisma migration
// (prisma/migrations/20260929120000_add_page_tutorials), but deploy.sh applies
// schema changes with node-pg-migrate only — so production never got the table
// and every admin /tutorials write returned a 500. This is the node-pg-migrate
// equivalent; IF NOT EXISTS keeps it a no-op on DBs that already have the table
// (dev/test databases built with `prisma db push`).
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "page_tutorials" (
            "id" TEXT NOT NULL,
            "page_key" TEXT NOT NULL,
            "youtube_url" TEXT NOT NULL,
            "title" TEXT,
            "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "page_tutorials_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "page_tutorials_page_key_key" ON "page_tutorials"("page_key");
    `);
};

exports.down = (pgm) => {
    pgm.sql('DROP TABLE IF EXISTS "page_tutorials";');
};
