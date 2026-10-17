// Operations dashboard — capacity inputs. Both columns are nullable: NULL means
// "capacity not configured", which excludes that person from capacity totals
// rather than defaulting to a guessed number.
//
// IF NOT EXISTS guards: an earlier, unmerged branch (fix/signup-orphan-user-takeover,
// migration 089) already added workspace_members.daily_plan_capacity to some
// databases, so this must apply cleanly whether or not 089 ran there.
//
// Touches exactly:
//   workspace_members.daily_plan_capacity    integer NULL  (max plan-units per calendar day)
//   workspaces.owner_daily_plan_capacity     integer NULL  (NULL = owner not counted as a trainer)
exports.up = (pgm) => {
    pgm.sql(`
        ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "daily_plan_capacity" INTEGER;
        ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "owner_daily_plan_capacity" INTEGER;
    `);
};

// Down is deliberately a no-op for workspace_members.daily_plan_capacity: on
// databases where 089 created it, dropping it here would destroy data this
// migration did not own. Only the column this migration introduced is removed.
exports.down = (pgm) => {
    pgm.sql(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "owner_daily_plan_capacity";`);
};
