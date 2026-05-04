---
name: Team Feature Plan
description: Finalized design decisions for the team/workspace multi-tenancy feature
type: project
---

A detailed implementation plan exists at `docs/team-feature-plan.md` (v2, finalized 2026-05-05).

**Architecture summary:**
- Identity: single `users` table. Membership tracked in `workspace_members` junction table (replaces the old `team_members` concept).
- Tenancy: `workspaces` table with its own auto-id. All existing data tables rename `coach_id` → `workspace_id` (numeric values unchanged — safe migration).
- Auth: single unified login (`/login`), single `token` cookie, JWT payload: `{ userId, workspaceId, role, permissions }`.
- Workspace switcher in top bar; `default_workspace_id` on users for auto-redirect on login.
- Dashboard URL prefix: `/[workspaceSlug]/` (e.g. `/john-fitness/clients`). Client portal stays `/portal/[workspaceSlug]`.
- Admin: completely separate `admins` table + `ADMIN_JWT_SECRET`. Admin login at `/admin/login`.

**Locked decisions:**
- Pending invitations count toward seat limits (not just active members).
- Workspace slug customization is one-time only per workspace.
- After ownership transfer, frontend triggers `POST /api/auth/switch-workspace` automatically for both parties to get fresh JWTs.
- Owners can only invite emails already registered on FitForce.
- Invited user must explicitly accept or decline (no auto-accept).
- Workspace archive is soft-delete (data preserved, restorable by admin).

**Roles:** owner (implicit via workspaces.owner_id), manager, trainer, nutritionist, receptionist, viewer.
**Permissions model:** Role sets default JSONB permissions per module. Owner can override per-member after creation.

**8 implementation phases defined** — Phase 1 closes the unprotected `/admin` security gap before anything else ships.

**Why:** To allow coaches to delegate work to staff while keeping a single identity per person across multiple workspaces.
