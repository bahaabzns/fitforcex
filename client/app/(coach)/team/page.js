"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import {
    Users2, UserPlus, Mail,
    Trash2, Clock, CheckCircle2, XCircle, Building2, Plus,
} from "lucide-react";

const ROLES = ["manager", "trainer", "assistant"];

// ── Upgrade CTA ───────────────────────────────────────────────────────────────

function UpgradeBanner({ message }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-500 mt-0.5 text-base leading-none">⚠</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">{message}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                    Contact us to upgrade your plan and unlock more capacity.
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

const ROLE_META = {
    owner:     { label: "Owner",     cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
    manager:   { label: "Manager",   cls: "bg-blue-50 text-blue-700 border border-blue-200" },
    trainer:   { label: "Trainer",   cls: "bg-green-50 text-green-700 border border-green-200" },
    assistant: { label: "Assistant", cls: "bg-secondary text-muted-foreground border border-border" },
};

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function RoleBadge({ role }) {
    const meta = ROLE_META[role] ?? { label: role, cls: "bg-secondary text-muted-foreground border border-border" };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

function Avatar({ fname, lname }) {
    const initials = `${fname?.[0] ?? ""}${lname?.[0] ?? ""}`.toUpperCase() || "?";
    return (
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
            {initials}
        </div>
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

// ── Members Tab ───────────────────────────────────────────────────────────────

function MembersTab({ workspace, members, setMembers, me, pendingCount }) {
    const isOwner = me?.currentWorkspace?.role === "owner";
    const canManage = isOwner || me?.currentWorkspace?.permissions?.team?.write;
    const canDelete = isOwner || me?.currentWorkspace?.permissions?.team?.delete;

    const maxSeats = workspace?.max_team_seats ?? null;
    const seatsUsed = parseInt(workspace?.member_count ?? 0) + (pendingCount ?? 0);
    const noSeats = maxSeats === 0;
    const atSeatLimit = maxSeats !== null && seatsUsed >= maxSeats;

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
            setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
            setInviteEmail("");
            setInviteMessage("");
        } catch (err) {
            setInviteError(err.response?.data?.message || "Failed to send invitation");
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

    return (
        <div className="flex flex-col gap-6">
            {/* Workspace stats */}
            {workspace && (
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
                        <Building2 size={15} className="text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Plan</p>
                            <p className="text-sm font-medium text-foreground">{workspace.plan_display_name ?? workspace.plan_name}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${atSeatLimit || noSeats ? "bg-amber-50 border-amber-200" : "bg-secondary/50 border-border"}`}>
                        <Users2 size={15} className={atSeatLimit || noSeats ? "text-amber-500" : "text-muted-foreground"} />
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Team Seats</p>
                            {maxSeats === null ? (
                                <p className="text-sm font-medium text-foreground">{workspace.member_count} <span className="text-muted-foreground font-normal">/ unlimited</span></p>
                            ) : noSeats ? (
                                <p className="text-sm font-medium text-amber-700">0 seats on Free plan</p>
                            ) : (
                                <div className="flex flex-col gap-1 min-w-32">
                                    <p className="text-sm font-medium text-foreground">
                                        {seatsUsed} used
                                        <span className="text-muted-foreground font-normal"> of {maxSeats}</span>
                                    </p>
                                    <SeatUsageBar used={seatsUsed} max={maxSeats} />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
                        <Users2 size={15} className="text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Clients</p>
                            <p className="text-sm font-medium text-foreground">{workspace.client_count}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite section */}
            {canManage && (
                (noSeats || atSeatLimit) ? (
                    <UpgradeBanner
                        message={noSeats
                            ? "Your Free plan doesn't include team seats."
                            : `You've used all ${maxSeats} seat${maxSeats === 1 ? "" : "s"} on your current plan.`
                        }
                    />
                ) : (
                    <div className="rounded-lg border border-border">
                        <button
                            onClick={() => { setShowInviteForm(o => !o); setInviteError(""); setInviteSuccess(""); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors rounded-lg cursor-pointer"
                        >
                            <UserPlus size={15} className="text-muted-foreground" />
                            <span className="flex-1 text-left">Invite team member</span>
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
                                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <CheckCircle2 size={14} /> {inviteSuccess}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-muted-foreground font-medium block mb-1">Email address *</label>
                                        <input
                                            type="email"
                                            placeholder="colleague@example.com"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            className={inputCls}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="w-36">
                                        <label className="text-xs text-muted-foreground font-medium block mb-1">Role *</label>
                                        <select
                                            value={inviteRole}
                                            onChange={e => setInviteRole(e.target.value)}
                                            className={inputCls}
                                        >
                                            {(isOwner ? ["manager", "trainer", "assistant"] : ["trainer", "assistant"]).map(r => (
                                                <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-medium block mb-1">Message (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="Add a personal note..."
                                        value={inviteMessage}
                                        onChange={e => setInviteMessage(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={inviting || !inviteEmail.trim()}
                                    className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors cursor-pointer"
                                >
                                    {inviting ? "Sending…" : "Send Invitation"}
                                </button>
                            </form>
                        )}
                    </div>
                )
            )}

            {/* Members list */}
            <div className="flex flex-col gap-0 rounded-lg border border-border overflow-hidden">
                {/* Owner row — always at top */}
                {workspace?.owner_fname && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-0">
                        <Avatar fname={workspace.owner_fname} lname={workspace.owner_lname} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {workspace.owner_fname} {workspace.owner_lname}
                                {workspace.owner_id === me?.userId && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{workspace.owner_email}</p>
                        </div>
                        <RoleBadge role="owner" />
                    </div>
                )}

                {members.length === 0 && (
                    <p className="px-4 py-6 text-sm text-muted-foreground text-center">No other members yet. Invite someone above.</p>
                )}

                {members.map(member => {
                    const roleChangeAllowed = canChangeRole(member);
                    const removeAllowed = canRemoveMember(member);
                    return (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                            <Avatar fname={member.fname} lname={member.lname} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {member.fname} {member.lname}
                                    {member.user_id === myUserId && (
                                        <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
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
                                        <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                                    ))}
                                </select>
                            ) : (
                                <RoleBadge role={member.role} />
                            )}

                            {removeAllowed ? (
                                <button
                                    onClick={() => setConfirmRemove(member)}
                                    disabled={removingId === member.id}
                                    title="Remove member"
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
                title="Remove member"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-foreground">
                        Remove <strong>{confirmRemove?.fname} {confirmRemove?.lname}</strong> from this workspace?
                        They will lose access immediately.
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setConfirmRemove(null)}
                            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleRemove(confirmRemove.id)}
                            disabled={removingId === confirmRemove?.id}
                            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                            {removingId === confirmRemove?.id ? "Removing…" : "Remove"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ── Invitations Tab (outgoing) ────────────────────────────────────────────────

function InvitationsTab({ workspace, invitations, setInvitations, me }) {
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
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border overflow-hidden">
            {invitations.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <Avatar fname={inv.fname} lname={inv.lname} />
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
                            title="Cancel invitation"
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
    const [respondingId, setRespondingId] = useState(null);
    const router = useRouter();

    async function handleAccept(inv) {
        setRespondingId(inv.id);
        try {
            await api.post(`/api/invitations/${inv.id}/accept`);
            setMyInvitations(prev => prev.filter(i => i.id !== inv.id));
            // Re-fetch me to update workspace list and pending count
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
                <p className="text-sm text-muted-foreground">No pending invitations for you.</p>
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
                                Invited by {inv.invitedBy.fname} {inv.invitedBy.lname} · as{" "}
                                <span className="font-medium capitalize">{inv.role}</span>
                            </p>
                            {inv.message && (
                                <p className="text-xs text-foreground/70 mt-0.5 italic">&ldquo;{inv.message}&rdquo;</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => handleDecline(inv.id)}
                            disabled={respondingId === inv.id}
                            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Decline
                        </button>
                        <button
                            onClick={() => handleAccept(inv)}
                            disabled={respondingId === inv.id}
                            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {respondingId === inv.id ? "…" : "Accept"}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Create Workspace Modal ────────────────────────────────────────────────────

function CreateWorkspaceModal({ open, onClose, onCreated, me, workspace }) {
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
            setError(err.response?.data?.message || "Failed to create workspace");
        } finally {
            setCreating(false);
        }
    }

    return (
        <Modal open={open} onClose={() => { reset(); onClose(); }} title="Create Workspace">
            <div className="flex flex-col gap-3">
                {atWorkspaceLimit ? (
                    <>
                        <UpgradeBanner
                            message={`Your plan allows ${maxWorkspaces} workspace${maxWorkspaces === 1 ? "" : "s"}. You've reached the limit.`}
                        />
                        <p className="text-xs text-muted-foreground">
                            You currently own {ownedCount} workspace{ownedCount === 1 ? "" : "s"}.
                        </p>
                    </>
                ) : (
                    <form onSubmit={handleCreate} className="flex flex-col gap-3">
                        {error && (
                            error.toLowerCase().includes("workspace") && error.toLowerCase().includes("plan") ? (
                                <UpgradeBanner message={error} />
                            ) : (
                                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )
                        )}
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">Workspace name *</label>
                            <input
                                type="text"
                                placeholder="e.g. Elite Performance Studio"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={inputCls}
                                required
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">
                                Slug <span className="font-normal opacity-60">(optional — auto-generated if blank)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="my-workspace"
                                value={slug}
                                onChange={e => setSlug(e.target.value)}
                                className={inputCls}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only.</p>
                        </div>
                        {maxWorkspaces !== null && (
                            <p className="text-xs text-muted-foreground">
                                {ownedCount} of {maxWorkspaces} workspace{maxWorkspaces === 1 ? "" : "s"} used on your plan.
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={creating || !name.trim()}
                            className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                            {creating ? "Creating…" : "Create Workspace"}
                        </button>
                    </form>
                )}
            </div>
        </Modal>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [tab, setTab] = useState("members");
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [myInvitations, setMyInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewWs, setShowNewWs] = useState(false);

    // Open create workspace modal if redirected from sidebar
    useEffect(() => {
        if (searchParams.get("action") === "new-workspace") {
            setShowNewWs(true);
            router.replace("/team");
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
        // Switch to the new workspace
        api.post("/api/auth/switch-workspace", { workspaceId: ws.id })
            .then(() => {
                router.push("/dashboard");
                router.refresh();
            })
            .catch(console.error);
    }

    const pendingOutgoing = invitations.length;
    const pendingIncoming = myInvitations.length;

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-foreground mb-6">Team</h1>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
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
                    <h1 className="text-3xl font-bold text-foreground">Team</h1>
                    {workspace && (
                        <p className="text-sm text-muted-foreground mt-0.5">{workspace.name}</p>
                    )}
                </div>
                <button
                    onClick={() => setShowNewWs(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                    <Plus size={14} />
                    New Workspace
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-border -mb-2">
                <div className="flex gap-0">
                    <TabButton active={tab === "members"} onClick={() => setTab("members")}>
                        <Users2 size={14} /> Members
                    </TabButton>
                    <TabButton active={tab === "invitations"} onClick={() => setTab("invitations")} badge={pendingOutgoing}>
                        <Mail size={14} /> Invitations
                    </TabButton>
                    <TabButton active={tab === "mine"} onClick={() => setTab("mine")} badge={pendingIncoming}>
                        <CheckCircle2 size={14} /> My Invitations
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
