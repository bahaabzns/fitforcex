// Service level goal: plans should be finished within this many days of the client submitting
// their answers. The Team Workload "Service level" panel measures against it. Default 2 days;
// owners/managers can change it from the dashboard.
//
// Touches exactly:
//   workspaces.service_target_days   integer NOT NULL DEFAULT 2
exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "service_target_days" INTEGER NOT NULL DEFAULT 2;`);
};

exports.down = (pgm) => {
    pgm.sql(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "service_target_days";`);
};
