// Per-person days off, so capacity numbers on the Team Workload dashboard are accurate.
// Weekday numbers follow Postgres/JS: 0 = Sunday ... 6 = Saturday. An empty array means
// "works every day" (the behaviour before this migration), so nothing changes until a
// coach sets days off.
//
// capacity_history gains the days-off before/after each change, so the dashboard can
// replay past capacity correctly. Rows written before this migration read back as an empty
// array, which is accurate: nobody had days off then.
//
// Touches exactly:
//   workspace_members.days_off               integer[] NOT NULL DEFAULT '{}'
//   workspaces.owner_days_off                integer[] NOT NULL DEFAULT '{}'
//   capacity_history.previous_days_off       integer[] NULL
//   capacity_history.new_days_off            integer[] NULL
exports.up = (pgm) => {
    pgm.sql(`
        ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "days_off" INTEGER[] NOT NULL DEFAULT '{}';
        ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "owner_days_off" INTEGER[] NOT NULL DEFAULT '{}';
        ALTER TABLE "capacity_history" ADD COLUMN IF NOT EXISTS "previous_days_off" INTEGER[];
        ALTER TABLE "capacity_history" ADD COLUMN IF NOT EXISTS "new_days_off" INTEGER[];
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        ALTER TABLE "capacity_history" DROP COLUMN IF EXISTS "new_days_off";
        ALTER TABLE "capacity_history" DROP COLUMN IF EXISTS "previous_days_off";
        ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "owner_days_off";
        ALTER TABLE "workspace_members" DROP COLUMN IF EXISTS "days_off";
    `);
};
