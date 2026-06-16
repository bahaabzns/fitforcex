"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";
import { Avatar } from "@heroui/react/avatar";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import {
    Users2, UserPlus, Mail,
    Trash2, Clock, CheckCircle2, XCircle, Building2, Plus, SlidersHorizontal,
} from 'lucide-react';

const ROLES = ["manager", "trainer", "assistant"];

const ROLE_META_CLS = {
    owner:     "bg-yellow-500/15 text-yellow-600 border border-yellow-500/20",
    manager:   "bg-accent/15 text-accent border border-accent/20",
    trainer:   "bg-green-500/15 text-green-600 border border-green-500/20",
    assistant: "bg-secondary text-muted-foreground border border-border",
};

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

// ── Upgrade CTA ───────────────────────────────────────────────────────────────

function UpgradeBanner({ message }) {
    const t = useTranslations("team");
    return (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <span className="text-amber-500 mt-0.5 text-base leading-none">⚠</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-600">{message}</p>
                <p className="text-xs text-amber-600/70 mt-0.5">
                    {t("upgradeContactUs")}
                </p>
            </div>
        </div>
    );
}

function SeatUsageBar({ used, max }) {
    const pct = Math.min(100, Math.round((used / max) * 100));
    const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-primary";
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{used} / {max}</span>
        </div>
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
    const cls = ROLE_META_CLS[role] ?? "bg-secondary text-muted-foreground border border-border";
    return (
        <Chip size="sm" className={cls}>
            {ROLE_LABELS[role] ?? role}
        </Chip>
    );
}

function MemberAvatar({ fname, lname }) {
    const initials = `${fname?.[0] ?? ""}${lname?.[0] ?? ""}`.toUpperCase() || "?";
    return (
        <Avatar className="w-8 h-8 shrink-0">
            <Avatar.Fallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</Avatar.Fallback>
        </Avatar>
    );
}

function TabButton({ active, onClick, children, badge }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
            {badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                    {badge}
                </span>
            )}
        </button>
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

                <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-3 py-2 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                                <div key={action} className="w-14 flex justify-center">
                                    <button
                                        onClick={() => toggle(mod, action)}
                                        className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                            perms[mod][action] ? "bg-primary" : "bg-secondary border border-border"
                                        }`}
                                        title={`${action} ${mod}`}
                                    >
                                        <span
                                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                                                perms[mod][action] ? "translate-x-4" : "translate-x-0.5"
                                            }`}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-2 justify-end pt-1">
                    <Button variant="ghost" onClick={onClose}>
                        {t("cancel")}
                    </Button>
                    <Button onClick={handleSave} isDisabled={saving} variant="primary">
                        {saving ? t("permSaving") : t("permSave")}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

function MembersTab({ workspace, members, setMembers, me, pendingCount }) {
    const t = useTranslations("team");
    const isOwner = me?.currentWorkspace?.role === "owner";
    const canManage = isOwner || me?.currentWorkspace?.permissions?.team?.write;
    const canDelete = isOwner || me?.currentWorkspace?.permissions?.team?.delete;

    const maxSeats = workspace?.max_team_seats ?? null;
    const seatsUsed = parseInt(workspace?.member_count ?? 0) + (pendingCount ?? 0);
    const noSeats = maxSeats === 0;
    const atSeatLimit = maxSeats !== null && seatsUsed >= maxSeats;

    const ROLE_LABELS = {
        manager: t("roleManager"),
        trainer: t("roleTrainer"),
        assistant: t("roleAssistant"),
    };

    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("trainer");
    const [inviteMessage, setInviteMessage] = useState("");
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState("");
    const [inviteSuccess, setInviteSuccess] = useState("");

    const [updatingRole, setUpdatingRole] = useState(null);
    const [removingId, setRemovingId] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [editingPerms, setEditingPerms] = useState(null);

    const wsId = workspace?.id;

    async function handleInvite(e) {
        e.preventDefault();
        setInviteError("");
        setInviteSuccess("");
        setInviting(true);
        try {
            await api.post(`/api/workspaces/${wsId}/invitations`, {
                email: inviteEmail.trim(),
                role: inviteRole,
                message: inviteMessage.trim() || undefined,
            });
            setInviteSuccess(t("inviteSent", { email: inviteEmail.trim() }));
            setInviteEmail("");
            setInviteMessage("");
        } catch (err) {
            setInviteError(err.response?.data?.message || t("inviteFailed"));
        } finally {
            setInviting(false);
        }
    }

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

    const upgradeBannerMessage = noSeats
        ? t("upgradeFreeSeats")
        : t("upgradeSeatLimit", { count: maxSeats });

    return (
        <div className="flex flex-col gap-6">
            {/* Workspace stats */}
            {workspace && (
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
                        <Building2 size={15} className="text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">{t("statPlan")}</p>
                            <p className="text-sm font-medium text-foreground">{workspace.plan_display_name ?? workspace.plan_name}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${atSeatLimit || noSeats ? "bg-amber-500/5 border-amber-500/30" : "bg-secondary/50 border-border"}`}>
                        <Users2 size={15} className={atSeatLimit || noSeats ? "text-amber-500" : "text-muted-foreground"} />
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t("statSeats")}</p>
                            {maxSeats === null ? (
                                <p className="text-sm font-medium text-foreground">{workspace.member_count} <span className="text-muted-foreground font-normal">{t("statUnlimited")}</span></p>
                            ) : noSeats ? (
                                <p className="text-sm font-medium text-amber-700">{t("statFreeSeats")}</p>
                            ) : (
                                <div className="flex flex-col gap-1 min-w-32">
                                    <p className="text-sm font-medium text-foreground">
                                        {t("statSeatsUsed", { count: seatsUsed })}
                                        <span className="text-muted-foreground font-normal"> {t("statSeatsOf", { count: maxSeats })}</span>
                                    </p>
                                    <SeatUsageBar used={seatsUsed} max={maxSeats} />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
                        <Users2 size={15} className="text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">{t("statClients")}</p>
                            <p className="text-sm font-medium text-foreground">{workspace.client_count}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite section */}
            {canManage && (
                (noSeats || atSeatLimit) ? (
                    <UpgradeBanner message={upgradeBannerMessage} />
                ) : (
                    <div className="rounded-lg border border-border">
                        <button
                            onClick={() => { setShowInviteForm(o => !o); setInviteError(""); setInviteSuccess(""); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-default transition-colors rounded-lg cursor-pointer"
                        >
                            <UserPlus size={15} className="text-muted-foreground" />
                            <span className="flex-1 text-left">{t("inviteTeamMember")}</span>
                            <span className={`text-muted-foreground text-xs transition-transform ${showInviteForm ? 'rotate-180' : ''}`}>▾</span>
                        </button>

                        {showInviteForm && (
                            <form onSubmit={handleInvite} className="px-4 pb-4 flex flex-col gap-3 border-t border-border pt-4">
                                {inviteError && (
                                    inviteError.toLowerCase().includes("seat") || inviteError.toLowerCase().includes("plan") ? (
                                        <UpgradeBanner message={inviteError} />
                                    ) : (
                                        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                                            {inviteError}
                                        </p>
                                    )
                                )}
                                {inviteSuccess && (
                                    <p className="text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <CheckCircle2 size={14} /> {inviteSuccess}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-muted-foreground font-medium block mb-1">{t("emailLabel")}</label>
                                        <input
                                            type="email"
                                            placeholder={t("emailPlaceholder")}
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            className={inputCls}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="w-36">
                                        <label className="text-xs text-muted-foreground font-medium block mb-1">{t("roleLabel")}</label>
                                        <select
                                            value={inviteRole}
                                            onChange={e => setInviteRole(e.target.value)}
                                            className={inputCls}
                                        >
                                            {(isOwner ? ["manager", "trainer", "assistant"] : ["trainer", "assistant"]).map(r => (
                                                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-medium block mb-1">{t("messageLabel")}</label>
                                    <input
                                        type="text"
                                        placeholder={t("messagePlaceholder")}
                                        value={inviteMessage}
                                        onChange={e => setInviteMessage(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    isDisabled={inviting || !inviteEmail.trim()}
                                    variant="primary"
                                    className="self-start"
                                >
                                    {inviting ? t("sending") : t("sendInvitation")}
                                </Button>
                            </form>
                        )}
                    </div>
                )
            )}

            {/* Members list */}
            <div className="flex flex-col gap-0 rounded-lg border border-border overflow-hidden">
                {workspace?.owner_fname && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-0">
                        <MemberAvatar fname={workspace.owner_fname} lname={workspace.owner_lname} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {workspace.owner_fname} {workspace.owner_lname}
                                {workspace.owner_id === me?.userId && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground">{t("youLabel")}</span>
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{workspace.owner_email}</p>
                        </div>
                        <RoleBadge role="owner" />
                    </div>
                )}

                {members.length === 0 && (
                    <p className="px-4 py-6 text-sm text-muted-foreground text-center">{t("noMembers")}</p>
                )}

                {members.map(member => {
                    const roleChangeAllowed = canChangeRole(member);
                    const removeAllowed = canRemoveMember(member);
                    return (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-0 hover:bg-default/30 transition-colors">
                            <MemberAvatar fname={member.fname} lname={member.lname} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {member.fname} {member.lname}
                                    {member.user_id === myUserId && (
                                        <span className="ml-1.5 text-[10px] text-muted-foreground">{t("youLabel")}</span>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                            </div>

                            {roleChangeAllowed ? (
                                <select
                                    value={member.role}
                                    onChange={e => handleRoleChange(member.id, e.target.value)}
                                    disabled={updatingRole === member.id}
                                    className="text-xs px-2 py-1 rounded-md border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    {(isOwner ? ROLES : ["trainer", "assistant"]).map(r => (
                                        <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                                    ))}
                                </select>
                            ) : (
                                <RoleBadge role={member.role} />
                            )}

                            {isOwner && (
                                <button
                                    onClick={() => setEditingPerms(member)}
                                    title={t("editPermissions")}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                >
                                    <SlidersHorizontal size={14} />
                                </button>
                            )}

                            {removeAllowed ? (
                                <button
                                    onClick={() => setConfirmRemove(member)}
                                    disabled={removingId === member.id}
                                    title={t("removeTitle")}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                </button>
                            ) : (
                                <div className="w-7" />
                            )}
                        </div>
                    );
                })}
            </div>

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
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                            {t("cancel")}
                        </Button>
                        <Button
                            onClick={() => handleRemove(confirmRemove.id)}
                            isDisabled={removingId === confirmRemove?.id}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {removingId === confirmRemove?.id ? t("removing") : t("remove")}
                        </Button>
                    </div>
                </div>
            </Modal>

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
        return (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Mail size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("noPendingInvitations")}</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border overflow-hidden">
            {invitations.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-0 hover:bg-default/30 transition-colors">
                    <MemberAvatar fname={inv.fname} lname={inv.lname} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{inv.fname} {inv.lname}</p>
                        <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                    </div>
                    <RoleBadge role={inv.role} />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock size={11} />
                        {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    {canManage && (
                        <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={cancellingId === inv.id}
                            title={t("cancelInvitation")}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <XCircle size={14} />
                        </button>
                    )}
                </div>
            ))}
        </div>
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
        return (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
                <CheckCircle2 size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("noMyInvitations")}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {myInvitations.map(inv => (
                <div key={inv.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 size={16} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{inv.workspace.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {t("invitedBy", { inviter: `${inv.invitedBy.fname} ${inv.invitedBy.lname}` })} · {t("invitedAs")}{" "}
                                <span className="font-medium capitalize">{inv.role}</span>
                            </p>
                            {inv.message && (
                                <p className="text-xs text-foreground/70 mt-0.5 italic">&ldquo;{inv.message}&rdquo;</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                </div>
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

    const ownedCount = me?.workspaces?.filter(w => w.role === "owner").length ?? 0;
    const maxWorkspaces = workspace?.max_workspaces ?? null;
    const atWorkspaceLimit = maxWorkspaces !== null && ownedCount >= parseInt(maxWorkspaces);

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
                {atWorkspaceLimit ? (
                    <>
                        <UpgradeBanner
                            message={t("workspacePlanLimit", { count: maxWorkspaces })}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t("ownedWorkspaces", { count: ownedCount })}
                        </p>
                    </>
                ) : (
                    <form onSubmit={handleCreate} className="flex flex-col gap-5 px-1 py-1">
                        {error && (
                            error.toLowerCase().includes("workspace") && error.toLowerCase().includes("plan") ? (
                                <UpgradeBanner message={error} />
                            ) : (
                                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )
                        )}
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
                            <p className="text-xs text-muted-foreground mt-1">{t("slugHint")}</p>
                        </div>
                        {maxWorkspaces !== null && (
                            <p className="text-xs text-muted-foreground">
                                {t("workspacesUsed", { used: ownedCount, max: maxWorkspaces })}
                            </p>
                        )}
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
                )}
            </div>
        </Modal>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
    const t = useTranslations("team");
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
    const pendingIncoming = myInvitations.length;

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-foreground mb-6">{t("pageTitle")}</h1>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
                </div>
                <Button
                    onClick={() => setShowNewWs(true)}
                    variant="outline"
                    size="sm"
                >
                    <Plus size={14} />
                    {t("newWorkspace")}
                </Button>
            </div>

            {/* Tabs */}
            <div className="border-b border-border -mb-2">
                <div className="flex gap-0">
                    <TabButton active={tab === "members"} onClick={() => setTab("members")}>
                        <Users2 size={14} /> {t("tabMembers")}
                    </TabButton>
                    <TabButton active={tab === "invitations"} onClick={() => setTab("invitations")} badge={pendingOutgoing}>
                        <Mail size={14} /> {t("tabInvitations")}
                    </TabButton>
                    <TabButton active={tab === "mine"} onClick={() => setTab("mine")} badge={pendingIncoming}>
                        <CheckCircle2 size={14} /> {t("tabMyInvitations")}
                    </TabButton>
                </div>
            </div>

            {/* Tab content */}
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
