// Schema counterpart for commit 1242737 ("feat(messenger): add attachment
// and edit/delete columns to messages") — that commit changed schema.prisma
// only and never got a migration, so these columns exist in schema.prisma
// (and presumably were pushed directly to some dev database) but were never
// applied via a committed, deployable migration. Confirmed missing from
// server/migrations/ entirely as of 2026-07-12; production's `messages`
// table almost certainly lacks them, which is why /messenger/.../attachments
// and /messenger/.../messages/:id (edit/delete) 404 or fail there today —
// see docs/deploy-hostinger.md's redeploy steps, which run this file via
// `npm run migrate`.
exports.up = (pgm) => {
    // ifNotExists: at least one database (local dev) already has these
    // columns from an out-of-band `prisma db push` predating this migration
    // — same drift this repo already hit with Forms Versioning (see
    // migrations 043/044). Production has neither the columns nor that
    // out-of-band push, so this still does real work there.
    pgm.addColumns('messages', {
        type: { type: 'text', notNull: true, default: "'text'" },
        attachment_url: { type: 'text' },
        attachment_name: { type: 'text' },
        attachment_size: { type: 'integer' },
        attachment_mime: { type: 'text' },
        attachment_duration: { type: 'integer' },
        edited_at: { type: 'timestamptz' },
        deleted_at: { type: 'timestamptz' },
    }, { ifNotExists: true });

    // Attachment-only messages have no text body. DROP NOT NULL is a no-op
    // if the column is already nullable, so this is safe either way.
    pgm.alterColumn('messages', 'body', { notNull: false });
};

exports.down = (pgm) => {
    pgm.alterColumn('messages', 'body', { notNull: true });
    pgm.dropColumns('messages', [
        'type', 'attachment_url', 'attachment_name', 'attachment_size',
        'attachment_mime', 'attachment_duration', 'edited_at', 'deleted_at',
    ]);
};
