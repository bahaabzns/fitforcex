// Announcements can be aimed at workspaces on specific subscription plans. An empty list means
// "show to everyone" (the behaviour before this migration), so existing announcements are unchanged.
// Plan ids are stored without a foreign key (they are validated on write): deleting a plan then
// simply stops matching, rather than blocking the delete.
//
// Touches exactly:
//   product_announcements.target_plan_ids   text[] NOT NULL DEFAULT '{}'
exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE "product_announcements" ADD COLUMN IF NOT EXISTS "target_plan_ids" TEXT[] NOT NULL DEFAULT '{}';`);
};

exports.down = (pgm) => {
    pgm.sql(`ALTER TABLE "product_announcements" DROP COLUMN IF EXISTS "target_plan_ids";`);
};
