// Messenger replies: a message can quote one earlier message in the same thread.
// Existing rows get NULL, so every old message loads exactly as before.
// ON DELETE SET NULL is only a backstop — messages are soft-deleted (deleted_at),
// so the quote normally survives and renders "This message was deleted".
//
// Touches exactly:
//   messages.reply_to_id   text NULL  REFERENCES messages(id) ON DELETE SET NULL
//   index messages_reply_to_id_idx
exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" TEXT REFERENCES "messages"("id") ON DELETE SET NULL;`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "messages_reply_to_id_idx" ON "messages" ("reply_to_id");`);
};

exports.down = (pgm) => {
    pgm.sql(`DROP INDEX IF EXISTS "messages_reply_to_id_idx";`);
    pgm.sql(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "reply_to_id";`);
};
