"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import { normalizeEmail } from "@/lib/normalizeEmail";
import { useDateFormatter } from "@/utils/useDateFormatter";
import Modal, { ModalFooter } from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";
import EmptyState from "@/app/components/EmptyState";
import StickySideTabs from "@/app/components/StickySideTabs";
import { StatCard } from "@/app/components/operations/KpiTrendCards";
import { FieldLabel } from "@/app/components/Field";
import { Alert } from "@heroui/react/alert";
import { Avatar } from "@heroui/react/avatar";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Input } from "@heroui/react/input";
import { ListBox } from "@heroui/react/list-box";
import { Select } from "@heroui/react/select";
import { Skeleton } from "@heroui/react/skeleton";
import { Switch } from "@heroui/react/switch";
import { TextField } from "@heroui/react/textfield";
import {
    Users2, UserPlus, Mail,
    Trash2, Clock, CheckCircle2, XCircle, Building2, SlidersHorizontal,
} from 'lucide-react';
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";
import CapacityEditModal from "@/app/components/operations/CapacityEditModal";
import { formatDaysOff } from "@/app/components/operations/weekdays";

const ROLES = ["manager", "trainer", "assistant"];

// Chip colours per role: the owner stands out, the rest follow the app's status colours.
const ROLE_CHIP_COLOR = { owner: "warning", manager: "accent", trainer: "success", assistant: "default" };

// ── Small shared pieces ───────────────────────────────────────────────────────

function StatusAlert({ status, children }) {
    if (!children) return null;
    return (
        <Alert status={status}>
            <Alert.Indicator />
            <Alert.Content>
                <Alert.Description>{children}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}

function UpgradeBanner({ message }) {
    const t = useTranslations("team");
    return (
        <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
                <Alert.Title>{message}</Alert.Title>
                <Alert.Description>{t("upgradeContactUs")}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}

function RoleBadge({ role }) {
    const t = useTranslations("team");
    const ROLE_LABELS = {
        owner: t("roleOwner"),
        manager: t("roleManager"),
        trainer: t("roleTrainer"),
        assistant: t("roleAssistant"),
    };
    return (
        <Chip size="sm" variant="soft" color={ROLE_CHIP_COLOR[role] ?? "default"}>
            {ROLE_LABELS[role] ?? role}
        </Chip>
    );
}

function MemberAvatar({ fname, lname }) {
    const initials = `${fname?.[0] ?? ""}${lname?.[0] ?? ""}`.toUpperCase() || "?";
    return (
        <Avatar size="sm" color="primary" className="shrink-0">
            <Avatar.Fallback>{initials}</Avatar.Fallback>
        </Avatar>
    );
}

// The role picker: HeroUI's select, which opens as a bottom sheet on phones (see globals.css).
function RoleSelect({ value, onChange, roles, labels, isDisabled = false, ariaLabel, className = "w-36" }) {
    return (
        <Select
            variant="secondary"
            aria-label={ariaLabel}
            value={value}
            onChange={(key) => onChange(String(key))}
            isDisabled={isDisabled}
            className={className}
        >
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="sheet-popover">
                <ListBox>
                    {roles.map((role) => (
                        <ListBox.Item key={role} id={role} textValue={labels[role] ?? role}>
                            {labels[role] ?? role}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

// One person in a list: avatar, name and email on the start side, their controls after. On a narrow screen
// the controls wrap under the name instead of squeezing it.
function PersonRow({ avatar, title, subtitle, children }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-default/30">
            <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                {avatar}
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{title}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

// A bordered list of rows in one card, separated by thin lines.
function RowList({ children }) {
    return (
        <Card className="rounded-xl">
            <Card.Content className="divide-y divide-border p-0">{children}</Card.Content>
        </Card>
    );
}

// ── Permissions Editor ────────────────────────────────────────────────────────

const MODULES = ["clients", "training", "nutrition", "forms", "finance", "team"];
const ACTIONS = ["read", "write", "delete"];

function PermissionsModal({ member, workspaceId, onClose, onSaved }) {
    const t = useTranslations("team");
    const [perms, setPerms] = useState(() => {
        const base = {};
        MODULES.forEach(mod => {
            base[mod] = { ...(member.permissions?.[mod] ?? { read: false, write: false, delete: false }) };
        });
        return base;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const MODULE_LABELS = {
        clients: t("modClients"),
        training: t("modTraining"),
        nutrition: t("modNutrition"),
        forms: t("modForms"),
        finance: t("modFinance"),
        team: t("modTeam"),
    };

    const ACTION_LABELS = {
        read: t("permRead"),
        write: t("permWrite"),
        delete: t("permDelete"),
    };

    function toggle(mod, action) {
        setPerms(prev => {
            const next = { ...prev, [mod]: { ...prev[mod], [action]: !prev[mod][action] } };
            if (action === "read" && !next[mod].read) {
                next[mod].write = false;
                next[mod].delete = false;
            }
            if ((action === "write" || action === "delete") && next[mod][action]) {
                next[mod].read = true;
            }
            return next;
        });
    }

    async function handleSave() {
        setSaving(true);
        setError("");
        try {
            await api.put(`/api/workspaces/${workspaceId}/members/${member.id}/permissions`, { permissions: perms });
            onSaved(member.id, perms);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || t("permFailed"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open onClose={onClose} title={t("permissionsTitle", { name: `${member.fname} ${member.lname}` })}>
            <div className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">
                    {t("permRole")} <span className="font-medium capitalize">{member.role}</span> · {t("permRoleHint")}
                </p>

                <div className="overflow-hidden rounded-xl border border-border">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 bg-default/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{t("permModule")}</span>
                        {ACTIONS.map(a => (
                            <span key={a} className="w-14 text-center capitalize">{ACTION_LABELS[a]}</span>
                        ))}
                    </div>

                    {MODULES.map((mod, idx) => (
                        <div
                            key={mod}
                            className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 px-3 py-2.5 ${idx > 0 ? "border-t border-border" : ""}`}
                        >
                            <span className="text-sm font-medium text-foreground">{MODULE_LABELS[mod] ?? mod}</span>
                            {ACTIONS.map(action => (
                                <div key={action} className="flex w-14 justify-center">
                                    <Switch
                                        size="sm"
                                        isSelected={perms[mod][action]}
                                        onChange={() => toggle(mod, action)}
                                        aria-label={`${ACTION_LABELS[action]} ${MODULE_LABELS[mod] ?? mod}`}
                                    >
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <StatusAlert status="danger">{error}</StatusAlert>

                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>
                        {t("cancel")}
                    </Button>
                    <Button onClick={handleSave} isDisabled={saving} variant="primary">
                        {saving ? t("permSaving") : t("permSave")}
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}

// ── Invite dialog ─────────────────────────────────────────────────────────────

// Inviting someone: opened by the page's "Invite team member" button. When the plan has no free seat the
// dialog says so instead of offering the form.
function InviteMemberModal({ open, onClose, workspace, me, pendingCount, onInvited }) {
    const t = useTranslations("team");
    const isOwner = me?.currentWorkspace?.role === "owner";

    const maxSeats = workspace?.max_team_seats ?? null;
    const seatsUsed = parseInt(workspace?.member_count ?? 0) + (pendingCount ?? 0);
    const noSeats = maxSeats === 0;
    const atSeatLimit = maxSeats !== null && seatsUsed >= maxSeats;

    const ROLE_LABELS = {
        manager: t("roleManager"),
        trainer: t("roleTrainer"),
        assistant: t("roleAssistant"),
    };
    const roles = isOwner ? ["manager", "trainer", "assistant"] : ["trainer", "assistant"];

    const [email, setEmail] = useState("");
    const [role, setRole] = useState("trainer");
    const [message, setMessage] = useState("");
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function close() {
        setError("");
        setSuccess("");
        onClose();
    }

    async function handleInvite(e) {
        e.preventDefault();
        setError("");
        setSuccess("");
        setInviting(true);
        try {
            const normalizedEmail = normalizeEmail(email);
            await api.post(`/api/workspaces/${workspace.id}/invitations`, {
                email: normalizedEmail,
                role,
                message: message.trim() || undefined,
            });
            setSuccess(t("inviteSent", { email: normalizedEmail }));
            setEmail("");
            setMessage("");
            onInvited?.();
        } catch (err) {
            setError(err.response?.data?.message || t("inviteFailed"));
        } finally {
            setInviting(false);
        }
    }

    return (
        <Modal open={open} onClose={close} title={t("inviteTeamMember")}>
            {noSeats || atSeatLimit ? (
                <div className="flex flex-col gap-4">
                    <UpgradeBanner message={noSeats ? t("upgradeFreeSeats") : t("upgradeSeatLimit", { count: maxSeats })} />
                    <ModalFooter>
                        <Button variant="ghost" onClick={close}>{t("cancel")}</Button>
                    </ModalFooter>
                </div>
            ) : (
                <form onSubmit={handleInvite} className="flex flex-col gap-4">
                    {error && (
                        error.toLowerCase().includes("seat") || error.toLowerCase().includes("plan")
                            ? <UpgradeBanner message={error} />
                            : <StatusAlert status="danger">{error}</StatusAlert>
                    )}
                    <StatusAlert status="success">{success}</StatusAlert>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel required>{t("emailLabel")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("emailLabel")} value={email} onChange={setEmail}>
                                <Input type="email" placeholder={t("emailPlaceholder")} autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5 sm:w-44">
                            <FieldLabel>{t("roleLabel")}</FieldLabel>
                            <RoleSelect
                                value={role} onChange={setRole}
                                roles={roles} labels={ROLE_LABELS}
                                ariaLabel={t("roleLabel")} className="w-full"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t("messageLabel")}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t("messageLabel")} value={message} onChange={setMessage}>
                            <Input type="text" placeholder={t("messagePlaceholder")} />
                        </TextField>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={close}>{t("cancel")}</Button>
                        <Button type="submit" variant="primary" isDisabled={inviting || !email.trim()}>
                            {inviting ? t("sending") : t("sendInvitation")}
                        </Button>
                    </ModalFooter>
                </form>
            )}
        </Modal>
    );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

// Roles whose daily plan capacity counts toward the Operations dashboard
// (mirrors the server's CAPACITY_ROLES; the owner is handled separately).
const CAPACITY_ROLES = ["trainer", "nutritionist", "manager"];

function CapacityButton({ value, daysOff, onClick }) {
    const tOps = useTranslations("operations");
    const locale = useLocale();
    const daysOffText = formatDaysOff(locale, daysOff);
    const isUnset = value === null || value === undefined;
    return (
        <Button
            variant="outline"
            size="sm"
            onPress={onClick}
            title={tOps("editCapacity")}
            className={`h-auto min-h-8 flex-col items-center gap-0 py-1 ${isUnset ? "border-dashed text-muted-foreground" : ""}`}
        >
            {isUnset ? tOps("setCapacity") : tOps("capacityPerDay", { count: value })}
            {daysOffText && <span className="text-[10px] font-normal text-muted-foreground">{tOps("daysOffShort", { days: daysOffText })}</span>}
        </Button>
    );
}

function MembersTab({ workspace, members, setMembers, me, pendingCount }) {
    const t = useTranslations("team");
    const tOps = useTranslations("operations");
    const isOwner = me?.currentWorkspace?.role === "owner";
    const canManage = isOwner || me?.currentWorkspace?.permissions?.team?.write;
    const canDelete = isOwner || me?.currentWorkspace?.permissions?.team?.delete;

    const maxSeats = workspace?.max_team_seats ?? null;
    const seatsUsed = parseInt(workspace?.member_count ?? 0) + (pendingCount ?? 0);
    const noSeats = maxSeats === 0;

    const ROLE_LABELS = {
        manager: t("roleManager"),
        trainer: t("roleTrainer"),
        assistant: t("roleAssistant"),
    };

    const [updatingRole, setUpdatingRole] = useState(null);
    const [removingId, setRemovingId] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [editingPerms, setEditingPerms] = useState(null);

    // Capacity (plans/day) feeds the Operations dashboard; owner and managers edit it.
    const canEditCapacity = isOwner || me?.currentWorkspace?.role === "manager";
    const [ownerCapacity, setOwnerCapacity] = useState(null);
    const [ownerDaysOff, setOwnerDaysOff] = useState([]);
    const [editingCapacity, setEditingCapacity] = useState(null); // { kind: "owner" } | { kind: "member", member }

    useEffect(() => {
        if (!canEditCapacity) return;
        api.get("/api/operations/capacity")
            .then(res => { setOwnerCapacity(res.data.ownerDailyCapacity); setOwnerDaysOff(res.data.ownerDaysOff ?? []); })
            .catch(() => {});
    }, [canEditCapacity]);

    const wsId = workspace?.id;

    async function handleRoleChange(memberId, newRole) {
        setUpdatingRole(memberId);
        try {
            const res = await api.put(`/api/workspaces/${wsId}/members/${memberId}`, { role: newRole });
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: res.data.role } : m));
        } catch (err) {
            console.error(err);
        } finally {
            setUpdatingRole(null);
        }
    }

    async function handleRemove(memberId) {
        setRemovingId(memberId);
        try {
            await api.delete(`/api/workspaces/${wsId}/members/${memberId}`);
            setMembers(prev => prev.filter(m => m.id !== memberId));
            setConfirmRemove(null);
        } catch (err) {
            console.error(err);
        } finally {
            setRemovingId(null);
        }
    }

    const myUserId = me?.userId;

    function canChangeRole(member) {
        if (member.user_id === myUserId) return false;
        if (isOwner) return true;
        if (!canManage) return false;
        if (member.role === "manager") return false;
        return true;
    }

    function canRemoveMember(member) {
        if (member.user_id === myUserId) return false;
        if (isOwner) return true;
        if (!canDelete) return false;
        if (member.role === "manager") return false;
        return true;
    }

    // How full the seats are, for the seats card's bar (same thresholds as the dashboard's utilization bars).
    const seatsPercent = maxSeats ? Math.min(100, Math.round((seatsUsed / maxSeats) * 100)) : 0;
    const seatsBarColor = seatsPercent >= 100 ? "#ef4444" : seatsPercent >= 80 ? "#f59e0b" : "var(--color-primary)";

    // The team as one table: the owner first, then everyone else. Each column renders its own cell, so the
    // permissions rules (who can change a role, remove someone, edit a limit) stay exactly as they were.
    const ownerRow = workspace?.owner_fname
        ? { id: "__owner__", kind: "owner", user_id: workspace.owner_id, fname: workspace.owner_fname, lname: workspace.owner_lname, email: workspace.owner_email, role: "owner" }
        : null;
    const tableRows = [...(ownerRow ? [ownerRow] : []), ...members.map(member => ({ ...member, kind: "member" }))];

    const columns = [
        {
            key: "name", label: t("colMember"), sortable: true, cardPriority: "primary",
            sortValue: (row) => `${row.fname} ${row.lname}`.toLowerCase(),
            render: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar fname={row.fname} lname={row.lname} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                            {row.fname} {row.lname}
                            {row.user_id === myUserId && <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">{t("youLabel")}</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "role", label: t("roleLabel"), sortable: true, cardPriority: "primary",
            sortValue: (row) => row.role,
            render: (row) => (row.kind === "member" && canChangeRole(row) ? (
                <RoleSelect
                    value={row.role} onChange={(role) => handleRoleChange(row.id, role)}
                    roles={isOwner ? ROLES : ["trainer", "assistant"]} labels={ROLE_LABELS}
                    isDisabled={updatingRole === row.id} ariaLabel={t("roleLabel")} className="w-36"
                />
            ) : <RoleBadge role={row.role} />),
        },
        ...(canEditCapacity ? [{
            key: "capacity", label: tOps("colCapacity"), cardPriority: "secondary",
            render: (row) => {
                if (row.kind === "owner") {
                    return <CapacityButton value={ownerCapacity} daysOff={ownerDaysOff} onClick={() => setEditingCapacity({ kind: "owner" })} />;
                }
                if (!CAPACITY_ROLES.includes(row.role)) return <span className="text-muted-foreground">—</span>;
                return <CapacityButton value={row.daily_plan_capacity} daysOff={row.days_off} onClick={() => setEditingCapacity({ kind: "member", member: row })} />;
            },
        }] : []),
        {
            key: "_actions", label: "", cardPriority: "secondary",
            render: (row) => (row.kind !== "member" ? null : (
                <div className="flex items-center justify-end gap-1">
                    {isOwner && (
                        <Button
                            isIconOnly size="sm" variant="ghost"
                            onPress={() => setEditingPerms(row)}
                            aria-label={t("editPermissions")} title={t("editPermissions")}
                        >
                            <SlidersHorizontal size={15} aria-hidden="true" />
                        </Button>
                    )}
                    {canRemoveMember(row) && (
                        <Button
                            isIconOnly size="sm" variant="ghost"
                            onPress={() => setConfirmRemove(row)}
                            isDisabled={removingId === row.id}
                            aria-label={t("removeTitle")} title={t("removeTitle")}
                            className="text-destructive"
                        >
                            <Trash2 size={15} aria-hidden="true" />
                        </Button>
                    )}
                </div>
            )),
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Workspace figures, as the same metric cards the dashboard uses */}
            {workspace && (
                <div className="grid grid-cols-2 *:min-w-0 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    <StatCard
                        compact
                        icon={Building2} label={t("statPlan")}
                        value={workspace.plan_display_name ?? workspace.plan_name}
                        hideDelta noChart
                    />
                    <StatCard
                        compact
                        icon={Users2} label={t("statSeats")}
                        value={noSeats ? "0" : String(maxSeats === null ? workspace.member_count : seatsUsed)}
                        caption={maxSeats === null ? t("statUnlimited") : noSeats ? t("statFreeSeats") : t("statSeatsOf", { count: maxSeats })}
                        bar={maxSeats && !noSeats ? { value: seatsPercent, color: seatsBarColor, label: t("statSeatsUsed", { count: seatsUsed }) } : null}
                        hideDelta noChart
                    />
                    <StatCard compact icon={Users2} label={t("statClients")} value={workspace.client_count} hideDelta noChart />
                    <StatCard compact icon={Mail} label={t("tabInvitations")} value={pendingCount ?? 0} hideDelta noChart />
                </div>
            )}

            {/* The team, as a table */}
            <DataTable
                columns={columns}
                data={tableRows}
                rowKey="id"
                mobileListView
                quickSearch={{ fields: ["fname", "lname", "email"], placeholder: t("searchMembers") }}
            />

            {/* Confirm remove modal */}
            <Modal
                open={!!confirmRemove}
                onClose={() => setConfirmRemove(null)}
                title={t("removeTitle")}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-foreground">
                        {t("removeConfirm", { name: `${confirmRemove?.fname} ${confirmRemove?.lname}` })}
                    </p>
                    <ModalFooter>
                        <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                            {t("cancel")}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => handleRemove(confirmRemove.id)}
                            isDisabled={removingId === confirmRemove?.id}
                        >
                            {removingId === confirmRemove?.id ? t("removing") : t("remove")}
                        </Button>
                    </ModalFooter>
                </div>
            </Modal>

            {/* Capacity editor modal */}
            {editingCapacity?.kind === "owner" && (
                <CapacityEditModal
                    name={`${workspace?.owner_fname ?? ""} ${workspace?.owner_lname ?? ""}`.trim()}
                    userId={workspace?.owner_id}
                    currentValue={ownerCapacity}
                    currentDaysOff={ownerDaysOff}
                    endpoint="/api/operations/capacity/owner"
                    hint={tOps("ownerCapacityHint")}
                    onClose={() => setEditingCapacity(null)}
                    onSaved={(dailyCapacity, daysOff) => { setOwnerCapacity(dailyCapacity); setOwnerDaysOff(daysOff); }}
                />
            )}
            {editingCapacity?.kind === "member" && (
                <CapacityEditModal
                    name={`${editingCapacity.member.fname} ${editingCapacity.member.lname}`.trim()}
                    userId={editingCapacity.member.user_id}
                    currentValue={editingCapacity.member.daily_plan_capacity}
                    currentDaysOff={editingCapacity.member.days_off ?? []}
                    endpoint={`/api/operations/capacity/members/${editingCapacity.member.id}`}
                    onClose={() => setEditingCapacity(null)}
                    onSaved={(dailyCapacity, daysOff) => setMembers(prev => prev.map(m =>
                        m.id === editingCapacity.member.id ? { ...m, daily_plan_capacity: dailyCapacity, days_off: daysOff } : m
                    ))}
                />
            )}

            {/* Permissions editor modal */}
            {editingPerms && (
                <PermissionsModal
                    member={editingPerms}
                    workspaceId={wsId}
                    onClose={() => setEditingPerms(null)}
                    onSaved={(memberId, newPerms) => {
                        setMembers(prev => prev.map(m =>
                            m.id === memberId ? { ...m, permissions: newPerms } : m
                        ));
                    }}
                />
            )}
        </div>
    );
}

// ── Invitations Tab (outgoing) ────────────────────────────────────────────────

function InvitationsTab({ workspace, invitations, setInvitations, me }) {
    const t = useTranslations("team");
    const { formatDate } = useDateFormatter();
    const isOwner = me?.currentWorkspace?.role === "owner";
    const canManage = isOwner || me?.currentWorkspace?.permissions?.team?.write;
    const [cancellingId, setCancellingId] = useState(null);

    async function handleCancel(invId) {
        setCancellingId(invId);
        try {
            await api.delete(`/api/workspaces/${workspace.id}/invitations/${invId}`);
            setInvitations(prev => prev.filter(i => i.id !== invId));
        } catch (err) {
            console.error(err);
        } finally {
            setCancellingId(null);
        }
    }

    if (invitations.length === 0) {
        return <EmptyState variant="firstTime" icon={Mail} title={t("noPendingInvitations")} />;
    }

    return (
        <RowList>
            {invitations.map(inv => (
                <PersonRow
                    key={inv.id}
                    avatar={<MemberAvatar fname={inv.fname} lname={inv.lname} />}
                    title={`${inv.fname} ${inv.lname}`}
                    subtitle={inv.email}
                >
                    <RoleBadge role={inv.role} />
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} aria-hidden="true" />
                        {formatDate(inv.created_at)}
                    </span>
                    {canManage && (
                        <Button
                            isIconOnly size="sm" variant="ghost"
                            onPress={() => handleCancel(inv.id)}
                            isDisabled={cancellingId === inv.id}
                            aria-label={t("cancelInvitation")} title={t("cancelInvitation")}
                            className="text-destructive"
                        >
                            <XCircle size={15} aria-hidden="true" />
                        </Button>
                    )}
                </PersonRow>
            ))}
        </RowList>
    );
}

// ── My Invitations Tab (incoming) ─────────────────────────────────────────────

function MyInvitationsTab({ myInvitations, setMyInvitations, setMe }) {
    const t = useTranslations("team");
    const [respondingId, setRespondingId] = useState(null);
    const router = useRouter();

    async function handleAccept(inv) {
        setRespondingId(inv.id);
        try {
            await api.post(`/api/invitations/${inv.id}/accept`);
            setMyInvitations(prev => prev.filter(i => i.id !== inv.id));
            const res = await api.get('/api/auth/me');
            setMe(res.data);
            router.refresh();
        } catch (err) {
            console.error(err);
        } finally {
            setRespondingId(null);
        }
    }

    async function handleDecline(invId) {
        setRespondingId(invId);
        try {
            await api.post(`/api/invitations/${invId}/decline`);
            setMyInvitations(prev => prev.filter(i => i.id !== invId));
            const res = await api.get('/api/auth/me');
            setMe(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setRespondingId(null);
        }
    }

    if (myInvitations.length === 0) {
        return <EmptyState variant="firstTime" icon={CheckCircle2} title={t("noMyInvitations")} />;
    }

    return (
        <div className="flex flex-col gap-3">
            {myInvitations.map(inv => (
                <Card key={inv.id} className="rounded-xl">
                    <Card.Content className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Building2 size={17} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{inv.workspace.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {t("invitedBy", { inviter: `${inv.invitedBy.fname} ${inv.invitedBy.lname}` })} · {t("invitedAs")}{" "}
                                    <span className="font-medium capitalize">{inv.role}</span>
                                </p>
                                {inv.message && (
                                    <p className="mt-0.5 text-xs italic text-foreground/70">&ldquo;{inv.message}&rdquo;</p>
                                )}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDecline(inv.id)}
                                isDisabled={respondingId === inv.id}
                            >
                                {t("decline")}
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAccept(inv)}
                                isDisabled={respondingId === inv.id}
                            >
                                {respondingId === inv.id ? "…" : t("accept")}
                            </Button>
                        </div>
                    </Card.Content>
                </Card>
            ))}
        </div>
    );
}

// ── Create Workspace Modal ────────────────────────────────────────────────────

function CreateWorkspaceModal({ open, onClose, onCreated, me, workspace }) {
    const t = useTranslations("team");
    const tCommon = useTranslations("common");
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    function reset() { setName(""); setSlug(""); setError(""); }

    async function handleCreate(e) {
        e.preventDefault();
        setError("");
        setCreating(true);
        try {
            const res = await api.post("/api/workspaces", { name: name.trim(), slug: slug.trim() || undefined });
            reset();
            onCreated(res.data);
        } catch (err) {
            setError(err.response?.data?.message || t("createFailed"));
        } finally {
            setCreating(false);
        }
    }

    return (
        <Modal open={open} onClose={() => { reset(); onClose(); }} title={t("createWorkspaceTitle")}>
            <div className="flex flex-col gap-3">
                <form onSubmit={handleCreate} className="flex flex-col gap-5 px-1 py-1">
                    <StatusAlert status="danger">{error}</StatusAlert>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t("workspaceNameLabel")}</FieldLabel>
                        <TextField variant="secondary" fullWidth isRequired aria-label={t("workspaceNameLabel")} value={name} onChange={setName}>
                            <Input type="text" placeholder={t("workspaceNamePlaceholder")} autoFocus />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>
                            {t("slugLabel")} <span className="font-normal opacity-60">{t("slugOptional")}</span>
                        </FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t("slugLabel")} value={slug} onChange={setSlug}>
                            <Input type="text" placeholder={t("slugPlaceholder")} />
                        </TextField>
                        <p className="mt-1 text-xs text-muted-foreground">{t("slugHint")}</p>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>
                            {tCommon("cancel")}
                        </Button>
                        <Button
                            type="submit"
                            isDisabled={creating || !name.trim()}
                            variant="primary"
                        >
                            {creating ? t("creating") : t("createWorkspace")}
                        </Button>
                    </ModalFooter>
                </form>
            </div>
        </Modal>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// A tab label with an optional count chip (pending invitations).
// A navigation label with an optional count chip (pending invitations).
function TabLabel({ icon: Icon, children, count = 0 }) {
    return (
        <span className="flex items-center justify-center gap-1.5">
            <Icon size={14} aria-hidden="true" />
            {children}
            {count > 0 && <Chip size="sm" color="accent">{count}</Chip>}
        </span>
    );
}

export default function TeamPage() {
    const t = useTranslations("team");
    usePageTitle(t('pageTitle'));
    const searchParams = useSearchParams();
    const router = useRouter();
    const { workspaceSlug } = useParams();

    const [tab, setTab] = useState("members");
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [myInvitations, setMyInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewWs, setShowNewWs] = useState(false);
    const [showInvite, setShowInvite] = useState(false);

    useEffect(() => {
        if (searchParams.get("action") === "new-workspace") {
            setShowNewWs(true);
            router.replace(`/${workspaceSlug}/team`);
        }
    }, [searchParams, router]);

    const load = useCallback(async () => {
        try {
            const meRes = await api.get("/api/auth/me");
            const currentMe = meRes.data;
            setMe(currentMe);
            const wsId = currentMe.currentWorkspace?.id;
            if (!wsId) return;

            const [wsRes, membersRes, invitationsRes, myInvRes] = await Promise.all([
                api.get(`/api/workspaces/${wsId}`),
                api.get(`/api/workspaces/${wsId}/members`),
                api.get(`/api/workspaces/${wsId}/invitations`).catch(() => ({ data: [] })),
                api.get("/api/invitations/me"),
            ]);

            setWorkspace(wsRes.data);
            setMembers(membersRes.data);
            setInvitations(invitationsRes.data.filter(i => i.status === "pending"));
            setMyInvitations(myInvRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    function handleWorkspaceCreated(ws) {
        setShowNewWs(false);
        api.post("/api/auth/switch-workspace", { workspaceId: ws.id })
            .then(() => { router.push(`/${ws.slug}/dashboard`); router.refresh(); })
            .catch(console.error);
    }

    const pendingOutgoing = invitations.length;
    const canInvite = me?.currentWorkspace?.role === "owner" || me?.currentWorkspace?.permissions?.team?.write === true;
    const pendingIncoming = myInvitations.length;

    if (loading) {
        return (
            <div className="p-4 sm:p-8">
                <h1 className="mb-6 text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{t("pageSubtitle")}</p>
                </div>
                {canInvite && (
                    <Button onClick={() => setShowInvite(true)} variant="primary" size="sm">
                        <UserPlus size={14} aria-hidden="true" />
                        {t("inviteTeamMember")}
                    </Button>
                )}
            </div>

            <TriggerInsightBanner
                triggerEvent="first_team_member_invited"
                checkUrl="/api/insights/prompts/for-trigger/first_team_member_invited"
                respondUrlPrefix="/api/insights/prompts"
                dismissUrlPrefix="/api/insights/prompts"
            />

            {/* The list on the left is the same one the dashboard uses; the content follows it. */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                <StickySideTabs
                    ariaLabel={t("pageTitle")}
                    selectedKey={tab}
                    onSelectionChange={setTab}
                    items={[
                        { id: "members", label: <TabLabel icon={Users2}>{t("tabMembers")}</TabLabel> },
                        { id: "invitations", label: <TabLabel icon={Mail} count={pendingOutgoing}>{t("tabInvitations")}</TabLabel> },
                        { id: "mine", label: <TabLabel icon={CheckCircle2} count={pendingIncoming}>{t("tabMyInvitations")}</TabLabel> },
                    ]}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    {tab === "members" && (
                        <MembersTab
                            workspace={workspace}
                            members={members}
                            setMembers={setMembers}
                            me={me}
                            pendingCount={invitations.length}
                        />
                    )}
                    {tab === "invitations" && (
                        <InvitationsTab
                            workspace={workspace}
                            invitations={invitations}
                            setInvitations={setInvitations}
                            me={me}
                        />
                    )}
                    {tab === "mine" && (
                        <MyInvitationsTab
                            myInvitations={myInvitations}
                            setMyInvitations={setMyInvitations}
                            setMe={setMe}
                        />
                    )}
                </div>
            </div>

            <InviteMemberModal
                open={showInvite}
                onClose={() => setShowInvite(false)}
                workspace={workspace}
                me={me}
                pendingCount={invitations.length}
                onInvited={load}
            />

            <CreateWorkspaceModal
                open={showNewWs}
                onClose={() => setShowNewWs(false)}
                onCreated={handleWorkspaceCreated}
                me={me}
                workspace={workspace}
            />
        </div>
    );
}
