import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NO_PACKAGE_FILTER } from './operations.constants';
import { DemandGroup, MemberInput, OwnerInput } from './operations.aggregate';

export interface DemandFilters {
    packageNames?: string[];   // any of these exact clients.current_package values; NO_PACKAGE_FILTER stands for "no package"
    postAction?:  string;   // 'nutrition-plan' | 'workout-plan'
    formType?:    string;   // 'assessment' | 'check-in'
}

// The queue's own action resolution (getQueue): the request's post_action, falling
// back to the form's. Kept identical so dashboard counts match the Plans Queue page.
const ACTION_SQL = Prisma.sql`COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing')`;
const TYPE_SQL = Prisma.sql`COALESCE(f.form_type, 'check-in')`;

// Prisma.join throws on an empty list, so fold the clauses by hand.
export function demandFilterSql(filters: DemandFilters): Prisma.Sql {
    const clauses: Prisma.Sql[] = [];
    if (filters.packageNames?.length) {
        const wantsNoPackage = filters.packageNames.includes(NO_PACKAGE_FILTER);
        const names = filters.packageNames.filter((name) => name !== NO_PACKAGE_FILTER);
        const byName = names.length ? Prisma.sql`c.current_package IN (${Prisma.join(names)})` : null;
        const byNone = wantsNoPackage ? Prisma.sql`c.current_package IS NULL` : null;
        clauses.push(byName && byNone ? Prisma.sql`AND (${byName} OR ${byNone})` : Prisma.sql`AND ${byName ?? byNone}`);
    }
    if (filters.postAction) clauses.push(Prisma.sql`AND ${ACTION_SQL} = ${filters.postAction}`);
    if (filters.formType) clauses.push(Prisma.sql`AND ${TYPE_SQL} = ${filters.formType}`);
    return clauses.reduce((all, clause) => Prisma.sql`${all} ${clause}`, Prisma.empty);
}

interface DemandRow {
    assignedTo: string | null; packageName: string | null; postAction: string; formType: string;
    bucket: 'need' | 'incoming'; count: number; oldestSubmittedAt: Date | null;
    over1d: number; over3d: number; over7d: number;
}

// "Needs action" == the queue's need-action bucket: status 'submitted', not archived.
// 'incoming' (pending/sent/scheduled) is aggregated alongside but never added to the headline.
// form_requests.submitted_at is timestamp WITHOUT time zone holding UTC, so "now" is
// compared in UTC regardless of the DB session's zone.
export async function loadDemandGroups(workspaceId: string, filters: DemandFilters = {}): Promise<DemandGroup[]> {
    const rows = await prisma.$queryRaw<DemandRow[]>`
        SELECT fr.assigned_to AS "assignedTo",
               c.current_package AS "packageName",
               ${ACTION_SQL} AS "postAction",
               ${TYPE_SQL} AS "formType",
               CASE WHEN fr.status = 'submitted' THEN 'need' ELSE 'incoming' END AS "bucket",
               COUNT(*)::int AS "count",
               MIN(fr.submitted_at) AS "oldestSubmittedAt",
               COUNT(*) FILTER (WHERE fr.submitted_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day')::int AS "over1d",
               COUNT(*) FILTER (WHERE fr.submitted_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '3 days')::int AS "over3d",
               COUNT(*) FILTER (WHERE fr.submitted_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days')::int AS "over7d"
        FROM form_requests fr
        JOIN forms f ON f.id = fr.form_id
        JOIN clients c ON c.id = fr.client_id
        WHERE fr.workspace_id = ${workspaceId}
          AND fr.archived_at IS NULL
          AND fr.status IN ('submitted', 'pending', 'sent', 'scheduled')
          ${demandFilterSql(filters)}
        GROUP BY 1, 2, 3, 4, 5
    `;
    return rows;
}

// The package names the chart filter can offer: every name any client in the workspace is on (so past
// requests from clients on a package no longer sold can still be filtered), and whether some clients have none.
export async function loadPackageOptions(workspaceId: string): Promise<{ packages: string[]; hasNoPackage: boolean }> {
    const rows = await prisma.$queryRaw<{ name: string | null }[]>`
        SELECT DISTINCT c.current_package AS name
        FROM clients c
        WHERE c.workspace_id = ${workspaceId}
        ORDER BY 1
    `;
    return {
        packages: rows.map((row) => row.name).filter((name): name is string => !!name),
        hasNoPackage: rows.some((row) => row.name === null),
    };
}

const fullName = (u: { fname: string; lname: string; email: string }) =>
    `${u.fname} ${u.lname}`.trim() || u.email;

export async function loadCapacityInputs(workspaceId: string): Promise<{ members: MemberInput[]; owner: OwnerInput }> {
    const [memberRows, workspace] = await Promise.all([
        prisma.workspace_members.findMany({
            where:  { workspace_id: workspaceId },
            select: {
                id: true, user_id: true, role: true, is_active: true, daily_plan_capacity: true, days_off: true,
                users: { select: { fname: true, lname: true, email: true } },
            },
        }),
        prisma.workspaces.findFirst({
            where:  { id: workspaceId },
            select: {
                owner_id: true, owner_daily_plan_capacity: true, owner_days_off: true,
                users_workspaces_owner_idTousers: { select: { fname: true, lname: true, email: true } },
            },
        }),
    ]);
    if (!workspace) throw new Error('Workspace not found');

    return {
        members: memberRows.map((m) => ({
            memberId: m.id, userId: m.user_id, name: fullName(m.users), role: m.role,
            isActive: m.is_active, dailyCapacity: m.daily_plan_capacity, daysOff: m.days_off,
        })),
        owner: {
            userId: workspace.owner_id,
            name: fullName(workspace.users_workspaces_owner_idTousers),
            dailyCapacity: workspace.owner_daily_plan_capacity,
            daysOff: workspace.owner_days_off,
        },
    };
}
