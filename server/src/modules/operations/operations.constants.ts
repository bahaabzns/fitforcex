// Single home for the dashboard's tunable numbers, so phase 2 can lift them into
// per-workspace settings without hunting through the service.

// Utilization (demand / capacity over the horizon) below TIGHT_FROM_PCT is
// "healthy"; from there up to OVERLOADED_ABOVE_PCT is "tight"; beyond it "overloaded".
export const TIGHT_FROM_PCT = 80;
export const OVERLOADED_ABOVE_PCT = 100;

export const HORIZON_DAYS_OPTIONS = [1, 3, 7] as const;
export const DEFAULT_HORIZON_DAYS = 1;

// Sanity ceiling for one person's plans/day: catches typos, not a business rule.
export const MAX_DAILY_PLAN_CAPACITY = 500;

// Roles whose capacity counts toward the team total. Receptionist/viewer never
// produce plans. The owner has no member row; see workspaces.owner_daily_plan_capacity.
export const CAPACITY_ROLES = ['trainer', 'nutritionist', 'manager'] as const;

export const NO_PACKAGE_FILTER = '__none__';

export type PlanAction = 'nutrition' | 'workout';
export type LoadStatus = 'healthy' | 'tight' | 'overloaded';
