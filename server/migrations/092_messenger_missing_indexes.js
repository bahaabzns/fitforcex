// Numbered 092, not 043: this checkout's migrations/ directory only has
// files through 042, but the shared dev/test databases already have 043-091
// applied (pre-existing drift between this branch and what's actually been
// migrated — not something this change caused or attempts to reconcile).
// 092 is the first number that can't collide with that already-run history.
//
// Messenger performance fix: GET /messenger/threads runs, per thread in the
// workspace, a LATERAL join for the latest message and a correlated subquery
// for the unread count — both filtering `messages` by thread_id plus extra
// predicates with only a bare `thread_id` index to work with. This endpoint
// is hit on every page load AND every 5s client poll (messenger/page.js), so
// the missing composite indexes compound badly. GET .../messages (full thread
// history, also polled every 5s) and its "mark as read" updateMany benefit
// from the same two indexes.
exports.up = (pgm) => {
    // Latest-message-per-thread lookup (messenger.controller.ts getThreads,
    // the `lm` LATERAL join) and the plain history read (getMessages,
    // `orderBy: created_at asc`) — both filter by thread_id and sort by
    // created_at.
    pgm.createIndex('messages', ['thread_id', 'created_at']);

    // Unread-count subquery (getThreads) and the "mark client messages read"
    // updateMany (getMessages) both filter thread_id + sender_type +
    // read_by_team_at IS NULL.
    pgm.createIndex('messages', ['thread_id', 'sender_type', 'read_by_team_at']);
};

exports.down = (pgm) => {
    pgm.dropIndex('messages', ['thread_id', 'sender_type', 'read_by_team_at']);
    pgm.dropIndex('messages', ['thread_id', 'created_at']);
};
