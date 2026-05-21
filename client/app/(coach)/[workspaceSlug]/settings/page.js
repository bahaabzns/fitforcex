"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/axios";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function TabButton({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}

function SuccessMsg({ msg }) {
    if (!msg) return null;
    return (
        <p className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="shrink-0" /> {msg}
        </p>
    );
}

function ErrorMsg({ msg }) {
    if (!msg) return null;
    return (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {msg}
        </p>
    );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ me }) {
    const [fname, setFname] = useState(me?.fname ?? "");
    const [lname, setLname] = useState(me?.lname ?? "");
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState("");
    const [nameSuccess, setNameSuccess] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPw, setSavingPw] = useState(false);
    const [pwError, setPwError] = useState("");
    const [pwSuccess, setPwSuccess] = useState("");

    useEffect(() => {
        setFname(me?.fname ?? "");
        setLname(me?.lname ?? "");
    }, [me]);

    async function handleSaveName(e) {
        e.preventDefault();
        if (!fname.trim()) return;
        setNameError(""); setNameSuccess("");
        setSavingName(true);
        try {
            await api.patch("/api/auth/profile", { fname: fname.trim(), lname: lname.trim() });
            setNameSuccess("Name updated successfully.");
        } catch (err) {
            setNameError(err.response?.data?.message || "Failed to update name.");
        } finally {
            setSavingName(false);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        setPwError(""); setPwSuccess("");
        if (newPassword !== confirmPassword) { setPwError("New passwords do not match."); return; }
        if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
        setSavingPw(true);
        try {
            await api.patch("/api/auth/profile", { currentPassword, newPassword });
            setPwSuccess("Password changed successfully.");
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        } catch (err) {
            setPwError(err.response?.data?.message || "Failed to change password.");
        } finally {
            setSavingPw(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Name */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Personal Info</h3>
                <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Email: </span>{me?.email}
                </div>
                <form onSubmit={handleSaveName} className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground font-medium block mb-1">First name</label>
                            <input
                                type="text"
                                value={fname}
                                onChange={e => setFname(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground font-medium block mb-1">Last name</label>
                            <input
                                type="text"
                                value={lname}
                                onChange={e => setLname(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <ErrorMsg msg={nameError} />
                    <SuccessMsg msg={nameSuccess} />
                    <Button
                        type="submit"
                        isDisabled={savingName || !fname.trim()}
                        variant="primary"
                        className="self-start"
                    >
                        {savingName ? "Saving…" : "Save Name"}
                    </Button>
                </form>
            </div>

            {/* Password */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
                <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">Current password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className={inputCls}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">New password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className={inputCls}
                            autoComplete="new-password"
                            required
                            minLength={8}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">Confirm new password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className={inputCls}
                            autoComplete="new-password"
                            required
                        />
                    </div>
                    <ErrorMsg msg={pwError} />
                    <SuccessMsg msg={pwSuccess} />
                    <Button
                        type="submit"
                        isDisabled={savingPw || !currentPassword || !newPassword || !confirmPassword}
                        variant="primary"
                        className="self-start"
                    >
                        {savingPw ? "Changing…" : "Change Password"}
                    </Button>
                </form>
            </div>
        </div>
    );
}

// ── Workspace Tab ─────────────────────────────────────────────────────────────

function WorkspaceTab({ me, workspace, setWorkspace }) {
    const isOwner = me?.currentWorkspace?.role === "owner";
    const wsId = me?.currentWorkspace?.id;

    // Rename
    const [wsName, setWsName] = useState(workspace?.name ?? "");
    const [renameSaving, setRenameSaving] = useState(false);
    const [renameError, setRenameError] = useState("");
    const [renameSuccess, setRenameSuccess] = useState("");

    // Slug
    const [newSlug, setNewSlug] = useState("");
    const [slugSaving, setSlugSaving] = useState(false);
    const [slugError, setSlugError] = useState("");
    const [slugSuccess, setSlugSuccess] = useState("");

    useEffect(() => {
        setWsName(workspace?.name ?? "");
    }, [workspace]);

    async function handleRename(e) {
        e.preventDefault();
        if (!wsName.trim()) return;
        setRenameError(""); setRenameSuccess("");
        setRenameSaving(true);
        try {
            const res = await api.patch(`/api/workspaces/${wsId}/name`, { name: wsName.trim() });
            setWorkspace(prev => ({ ...prev, name: res.data.name }));
            setRenameSuccess("Workspace renamed successfully.");
        } catch (err) {
            setRenameError(err.response?.data?.message || "Failed to rename workspace.");
        } finally {
            setRenameSaving(false);
        }
    }

    async function handleCustomizeSlug(e) {
        e.preventDefault();
        setSlugError(""); setSlugSuccess("");
        setSlugSaving(true);
        try {
            const res = await api.put(`/api/workspaces/${wsId}/slug`, { slug: newSlug.trim() });
            setWorkspace(prev => ({ ...prev, slug: res.data.slug, slug_customized: true }));
            setSlugSuccess("Slug updated. Share the new portal URL with your clients.");
            setNewSlug("");
        } catch (err) {
            setSlugError(err.response?.data?.message || "Failed to update slug.");
        } finally {
            setSlugSaving(false);
        }
    }

    const portalUrl = typeof window !== "undefined"
        ? `${window.location.origin}/portal/${workspace?.slug}`
        : `/portal/${workspace?.slug}`;

    return (
        <div className="flex flex-col gap-6">
            {/* Rename */}
            {isOwner && (
                <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-foreground">Workspace Name</h3>
                    <form onSubmit={handleRename} className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
                            <input
                                type="text"
                                value={wsName}
                                onChange={e => setWsName(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <ErrorMsg msg={renameError} />
                        <SuccessMsg msg={renameSuccess} />
                        <Button
                            type="submit"
                            isDisabled={renameSaving || !wsName.trim() || wsName.trim() === workspace?.name}
                            variant="primary"
                            className="self-start"
                        >
                            {renameSaving ? "Saving…" : "Save"}
                        </Button>
                    </form>
                </div>
            )}

            {/* Portal URL */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Client Portal</h3>
                <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Your Portal URL</label>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <code className="text-sm text-foreground break-all">{portalUrl}</code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Share this link with your clients so they can access their training and nutrition plans.
                    </p>
                </div>

                {/* Slug customization — owner only, once */}
                {isOwner && !workspace?.slug_customized && (
                    <form onSubmit={handleCustomizeSlug} className="flex flex-col gap-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            Customize your portal slug to something memorable. <strong>This can only be done once.</strong>
                        </p>
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">Custom slug</label>
                            <div className="flex items-center gap-0">
                                <span className="px-3 py-2 rounded-l-md border border-r-0 border-input bg-secondary text-muted-foreground text-sm select-none">
                                    /portal/
                                </span>
                                <input
                                    type="text"
                                    placeholder="your-slug"
                                    value={newSlug}
                                    onChange={e => setNewSlug(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-r-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only.</p>
                        </div>
                        <ErrorMsg msg={slugError} />
                        <SuccessMsg msg={slugSuccess} />
                        <Button
                            type="submit"
                            isDisabled={slugSaving || !newSlug.trim()}
                            variant="primary"
                            className="self-start"
                        >
                            {slugSaving ? "Saving…" : "Customize Slug"}
                        </Button>
                    </form>
                )}

                {workspace?.slug_customized && (
                    <p className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                        ✓ Your portal slug has been customized and cannot be changed again.
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

const STATUS_CHIP = {
    paid:     "bg-green-500/15 text-green-600",
    pending:  "bg-yellow-500/15 text-yellow-600",
    failed:   "bg-red-500/15 text-red-600",
    refunded: "bg-orange-500/15 text-orange-600",
};

function BillingTab() {
    const [data, setData]             = useState(null);
    const [plans, setPlans]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [paying, setPaying]         = useState(false);
    const [error, setError]           = useState("");
    const [iframeUrl, setIframeUrl]   = useState(null);
    const [iframePayId, setIframePayId] = useState(null);
    const [payStatus, setPayStatus]   = useState(null); // null | 'confirmed' | 'processing'

    function loadBilling() {
        return Promise.all([
            api.get("/api/billing/subscription"),
            api.get("/api/billing/plans"),
        ]).then(([subRes, plansRes]) => {
            setData(subRes.data);
            setPlans(plansRes.data);
        }).catch(() => setError("Failed to load billing info."))
          .finally(() => setLoading(false));
    }

    useEffect(() => { loadBilling(); }, []);

    // Listen for payment_confirmed postMessage from the callback iframe
    useEffect(() => {
        function onMessage(e) {
            if (e.data === 'payment_confirmed') {
                setPayStatus('confirmed');
                loadBilling();
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // Poll payment status while iframe is open (fallback if postMessage doesn't fire)
    useEffect(() => {
        if (!iframePayId) return;
        let attempts = 0;
        const id = setInterval(async () => {
            try {
                const res = await api.get(`/api/billing/payment-status/${iframePayId}`);
                if (res.data.status === "paid") {
                    clearInterval(id);
                    setPayStatus("confirmed");
                    loadBilling();
                } else if (attempts++ > 60) {
                    clearInterval(id);
                    setPayStatus("processing");
                }
            } catch { /* keep polling */ }
        }, 3000);
        return () => clearInterval(id);
    }, [iframePayId]);

    function closeIframe() {
        setIframeUrl(null);
        setIframePayId(null);
        setPayStatus(null);
    }

    async function handlePay(planId) {
        setPaying(planId);
        setError("");
        try {
            const res = await api.post("/api/billing/create-invoice", { planId });
            setIframeUrl(res.data.paymentUrl);
            setIframePayId(res.data.paymentId);
            setPayStatus(null);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to start payment. Please try again.");
        } finally {
            setPaying(false);
        }
    }

    if (loading) return (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
    );

    if (error && !data) return <ErrorMsg msg={error} />;

    const { subscription, payments } = data ?? {};
    const isExpired  = subscription?.daysRemaining === 0;
    const isExpiring = !isExpired && subscription?.daysRemaining !== null && subscription.daysRemaining <= 7;

    return (
        <div className="flex flex-col gap-6">
            {/* Current plan card */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current Plan</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{subscription?.planDisplay ?? "—"}</p>
                    </div>
                    <Chip size="sm" className={
                        subscription?.status === "active"
                            ? "bg-green-500/15 text-green-600"
                            : "bg-red-500/15 text-red-600"
                    }>
                        {subscription?.status ?? "unknown"}
                    </Chip>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Days Remaining</p>
                        <p className={`text-xl font-bold mt-0.5 ${
                            isExpired ? "text-destructive" : isExpiring ? "text-orange-500" : "text-foreground"
                        }`}>
                            {subscription?.daysRemaining ?? "∞"}
                        </p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                            {subscription?.expiresAt
                                ? new Date(subscription.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "—"}
                        </p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Team Seats</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                            {subscription?.maxTeamSeats ?? "∞"}
                        </p>
                    </div>
                </div>

                {(isExpired || isExpiring) && (
                    <p className={`text-sm rounded-lg px-3 py-2 border ${
                        isExpired
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                    }`}>
                        {isExpired
                            ? "Your subscription has expired. Renew below to restore access."
                            : `Your subscription expires in ${subscription.daysRemaining} days. Renew now to avoid interruption.`}
                    </p>
                )}
            </div>

            {/* Plans */}
            <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                    {isExpired ? "Choose a plan to reactivate" : "Renew or upgrade your plan"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {plans.map(plan => (
                        <div key={plan.id} className={`rounded-lg border p-4 flex flex-col gap-3 ${
                            subscription?.planId === plan.id ? "border-primary bg-primary/5" : "border-border"
                        }`}>
                            <div>
                                <p className="font-semibold text-foreground">{plan.display_name}</p>
                                {plan.max_team_seats && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Up to {plan.max_team_seats} team seats</p>
                                )}
                            </div>
                            <div>
                                <span className="text-2xl font-bold text-foreground">
                                    {plan.price_monthly ? `${Number(plan.price_monthly).toLocaleString()} EGP` : "Free"}
                                </span>
                                {plan.price_monthly && (
                                    <span className="text-xs text-muted-foreground ml-1">/ {plan.duration_days} days</span>
                                )}
                            </div>
                            {plan.price_monthly ? (
                                <Button
                                    variant="primary"
                                    isDisabled={!!paying}
                                    onClick={() => handlePay(plan.id)}
                                    className="w-full"
                                >
                                    {paying === plan.id
                                        ? "Redirecting…"
                                        : subscription?.planId === plan.id ? "Renew" : "Switch & Pay"}
                                </Button>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">No payment required</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {error && <ErrorMsg msg={error} />}

            {/* Payment iframe overlay */}
            {iframeUrl && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-xl flex flex-col w-full max-w-2xl" style={{ height: "80vh" }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                            <p className="text-sm font-semibold text-foreground">Complete Payment</p>
                            <button onClick={closeIframe} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
                        </div>

                        {payStatus === "confirmed" ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">Payment Confirmed!</p>
                                    <p className="text-sm text-muted-foreground mt-1">Your subscription has been activated.</p>
                                </div>
                                <Button variant="primary" onClick={closeIframe}>Done</Button>
                            </div>
                        ) : payStatus === "processing" ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">Payment Processing</p>
                                    <p className="text-sm text-muted-foreground mt-1">Your subscription will activate shortly.</p>
                                </div>
                                <Button variant="primary" onClick={closeIframe}>Close</Button>
                            </div>
                        ) : (
                            <iframe
                                src={iframeUrl}
                                className="flex-1 w-full rounded-b-xl border-0"
                                title="Fawaterak Payment"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Payment history */}
            {payments?.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-foreground mb-3">Payment History</p>
                    <div className="rounded-lg border border-border overflow-hidden">
                        {payments.map((p, idx) => (
                            <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-border" : ""}`}>
                                <div>
                                    <p className="text-sm font-medium text-foreground">{p.plan_display}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        {" · "}{p.duration_days} days
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-foreground">
                                        {Number(p.amount).toLocaleString()} {p.currency}
                                    </span>
                                    <Chip size="sm" className={STATUS_CHIP[p.fawaterak_status] ?? "bg-secondary text-muted-foreground"}>
                                        {p.fawaterak_status}
                                    </Chip>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Danger Zone Tab ───────────────────────────────────────────────────────────

function DangerZoneTab({ me, workspace, members }) {
    const router = useRouter();
    const isOwner = me?.currentWorkspace?.role === "owner";
    const wsId = me?.currentWorkspace?.id;

    // Transfer ownership
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferMemberId, setTransferMemberId] = useState("");
    const [transferPassword, setTransferPassword] = useState("");
    const [transferring, setTransferring] = useState(false);
    const [transferError, setTransferError] = useState("");

    // Archive
    const [showArchive, setShowArchive] = useState(false);
    const [archiveConfirm, setArchiveConfirm] = useState("");
    const [archiving, setArchiving] = useState(false);
    const [archiveError, setArchiveError] = useState("");

    async function handleTransfer(e) {
        e.preventDefault();
        setTransferError("");
        setTransferring(true);
        try {
            await api.post(`/api/workspaces/${wsId}/transfer-ownership`, {
                memberId: parseInt(transferMemberId),
                ownerPassword: transferPassword,
            });
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setTransferError(err.response?.data?.message || "Failed to transfer ownership.");
        } finally {
            setTransferring(false);
        }
    }

    async function handleArchive(e) {
        e.preventDefault();
        if (archiveConfirm !== workspace?.name) return;
        setArchiveError("");
        setArchiving(true);
        try {
            await api.delete(`/api/workspaces/${wsId}`);
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setArchiveError(err.response?.data?.message || "Failed to archive workspace.");
        } finally {
            setArchiving(false);
        }
    }

    if (!isOwner) {
        return (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">Only the workspace owner can access danger zone settings.</p>
            </div>
        );
    }

    const activeMembers = members.filter(m => m.is_active);

    return (
        <div className="flex flex-col gap-4">
            {/* Transfer Ownership */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Transfer Ownership</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Transfer this workspace to another active member. You will become a Manager.
                        </p>
                    </div>
                </div>

                {!showTransfer ? (
                    <Button
                        onClick={() => setShowTransfer(true)}
                        isDisabled={activeMembers.length === 0}
                        className="self-start border border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
                    >
                        Transfer Ownership
                    </Button>
                ) : (
                    <form onSubmit={handleTransfer} className="flex flex-col gap-3">
                        {activeMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No active members to transfer to. Invite a team member first.</p>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs text-muted-foreground font-medium block mb-1">Transfer to</label>
                                    <select
                                        value={transferMemberId}
                                        onChange={e => setTransferMemberId(e.target.value)}
                                        className={inputCls}
                                        required
                                    >
                                        <option value="">Select a member…</option>
                                        {activeMembers.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.fname} {m.lname} ({m.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-medium block mb-1">Your password to confirm</label>
                                    <input
                                        type="password"
                                        value={transferPassword}
                                        onChange={e => setTransferPassword(e.target.value)}
                                        className={inputCls}
                                        required
                                        autoComplete="current-password"
                                    />
                                </div>
                                <ErrorMsg msg={transferError} />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => { setShowTransfer(false); setTransferError(""); setTransferPassword(""); setTransferMemberId(""); }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        isDisabled={transferring || !transferMemberId || !transferPassword}
                                        className="bg-amber-600 text-white hover:bg-amber-700"
                                    >
                                        {transferring ? "Transferring…" : "Confirm Transfer"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </form>
                )}
            </div>

            {/* Archive */}
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Archive Workspace</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Archiving hides this workspace and removes access for all members. This cannot be undone.
                        </p>
                    </div>
                </div>

                {!showArchive ? (
                    <Button
                        onClick={() => setShowArchive(true)}
                        className="self-start border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    >
                        Archive Workspace
                    </Button>
                ) : (
                    <form onSubmit={handleArchive} className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">
                                Type <strong>{workspace?.name}</strong> to confirm
                            </label>
                            <input
                                type="text"
                                value={archiveConfirm}
                                onChange={e => setArchiveConfirm(e.target.value)}
                                className={inputCls}
                                placeholder={workspace?.name}
                            />
                        </div>
                        <ErrorMsg msg={archiveError} />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => { setShowArchive(false); setArchiveConfirm(""); setArchiveError(""); }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                isDisabled={archiving || archiveConfirm !== workspace?.name}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {archiving ? "Archiving…" : "Archive Workspace"}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const VALID_TABS = ["profile", "workspace", "billing", "danger"];

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const initialTab = VALID_TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "profile";
    const [tab, setTab] = useState(initialTab);
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const meRes = await api.get("/api/auth/me");
            setMe(meRes.data);
            const wsId = meRes.data.currentWorkspace?.id;
            if (!wsId) return;
            const [wsRes, membersRes] = await Promise.all([
                api.get(`/api/workspaces/${wsId}`),
                api.get(`/api/workspaces/${wsId}/members`).catch(() => ({ data: [] })),
            ]);
            setWorkspace(wsRes.data);
            setMembers(membersRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="p-8 max-w-2xl">
                <Skeleton className="h-9 w-28 rounded-lg mb-6" />
                <div className="flex gap-2 mb-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-24 rounded" />)}
                </div>
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Configure your workspace preferences and profile details.</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-border -mb-2">
                <div className="flex gap-0">
                    <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>Profile</TabButton>
                    <TabButton active={tab === "workspace"} onClick={() => setTab("workspace")}>Workspace</TabButton>
                    {me?.currentWorkspace?.role === "owner" && (
                        <TabButton active={tab === "billing"} onClick={() => setTab("billing")}>Billing</TabButton>
                    )}
                    {me?.currentWorkspace?.role === "owner" && (
                        <TabButton active={tab === "danger"} onClick={() => setTab("danger")}>
                            <span className="text-destructive">Danger Zone</span>
                        </TabButton>
                    )}
                </div>
            </div>

            {tab === "profile"   && <ProfileTab me={me} />}
            {tab === "workspace" && <WorkspaceTab me={me} workspace={workspace} setWorkspace={setWorkspace} />}
            {tab === "billing"   && <BillingTab />}
            {tab === "danger"    && <DangerZoneTab me={me} workspace={workspace} members={members} />}
        </div>
    );
}
