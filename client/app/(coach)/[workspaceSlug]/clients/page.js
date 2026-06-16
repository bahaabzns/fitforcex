"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Trash2, UploadCloud, X, CreditCard, ClipboardList, FileText, Snowflake, Sun, ListChecks } from 'lucide-react';
import DataTable from "@/app/components/DataTable";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import Stepper from "@/app/components/Stepper";
import ActionBar from "@/app/components/ActionBar";
import api from "@/lib/axios";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { InputGroup } from "@heroui/react/input-group";
import { Label } from "@heroui/react/label";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import CountryCodeSelect from "@/app/components/CountryCodeSelect";
import { Switch } from "@heroui/react/switch";
import { DatePicker } from "@heroui/react/date-picker";
import { DateField } from "@heroui/react/date-field";
import { Calendar } from "@heroui/react/calendar";
import { Separator } from "@heroui/react/separator";
import { Tooltip } from "@heroui/react/tooltip";
import { Link as UILink } from "@heroui/react/link";
import { today, getLocalTimeZone } from "@internationalized/date";

// --- HELPERS ---
function statusChipColor(status) {
    switch (status) {
        case "Active":           return "success";
        case "Expired":          return "danger";
        case "Frozen":           return "accent";
        case "Pre-start":        return "warning";
        case "No Subscriptions": return "default";
        default:                 return "default";
    }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{7,15}$/;

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

// --- FIELD LABEL (with red required marker) ---
// --- EMPTY STATE CARD (shown when an optional step is toggled off) ---
function EmptyStateNote({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-7 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                <Icon className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
    );
}

// --- DATE PICKER FIELD (HeroUI DatePicker + Calendar composition) ---
function DatePickerField({ value, onChange, ariaLabel, isInvalid, isDisabled }) {
    return (
        <DatePicker className="w-full" aria-label={ariaLabel} value={value} onChange={onChange} isInvalid={isInvalid} isDisabled={isDisabled}>
            <DateField.Group fullWidth variant="secondary">
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover>
                <Calendar aria-label={ariaLabel}>
                    <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                        <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                            {({ year }) => <Calendar.YearPickerCell year={year} />}
                        </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                </Calendar>
            </DatePicker.Popover>
        </DatePicker>
    );
}

// Format a DateValue (or null) as "YYYY-MM-DD" for display / API.
function dateToStr(dateValue) {
    return dateValue ? dateValue.toString() : "";
}

// Human-readable file size.
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- PROOF DROP ZONE (drag-and-drop single file upload) ---
function ProofDropZone({ file, onChange }) {
    const t = useTranslations('clients');
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    function pickFirst(fileList) {
        const picked = fileList && fileList[0];
        if (picked) onChange(picked);
    }

    if (file) {
        const ext = (file.name.split(".").pop() || "file").toUpperCase();
        return (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
                    {ext.slice(0, 4)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    aria-label={t('removeProof')}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(null)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFirst(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/60"
            }`}
        >
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{t('proofDropLabel')}</span>
            <span className="text-[11px] text-muted-foreground">{t('proofDropHint')}</span>
            <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => pickFirst(e.target.files)}
            />
        </div>
    );
}

// --- REVIEW SUMMARY ROW ---
function ReviewRow({ label, value, mono }) {
    return (
        <div className="flex items-start justify-between gap-4 px-4 py-2.5">
            <span className="text-xs text-muted-foreground font-medium shrink-0">{label}</span>
            <span className={`text-sm text-foreground text-right break-words ${mono ? "font-mono" : ""}`}>{value}</span>
        </div>
    );
}

// --- PAGE ---
export default function ClientsPage() {
    const t = useTranslations('clients');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const { workspaceSlug } = useParams();

    // Forms store localized titles (title_en / title_ar); resolve by active locale.
    const formTitle = (f) => (locale === "ar" ? f.title_ar || f.title_en : f.title_en) || f.title_en;
    const [clients, setClients]           = useState([]);
    const [packages, setPackages]         = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [availableForms, setAvailableForms] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [credsModal, setCredsModal]         = useState(null); // { email, password } | null
    const [credsCopied, setCredsCopied]       = useState(false);
    const [clientLimitModal, setClientLimitModal] = useState(null); // { limit: number } | null

    // Add-client wizard
    const [showForm, setShowForm]             = useState(false);
    const [currentStep, setCurrentStep]       = useState(0);
    const [newFirstName, setNewFirstName]     = useState("");
    const [newLastName, setNewLastName]       = useState("");
    const [newEmail, setNewEmail]             = useState("");
    const [newPassword, setNewPassword]       = useState(generatePassword());
    const [showPassword, setShowPassword]     = useState(false);
    const [newPhones, setNewPhones]           = useState([{ countryCode: "+20", number: "" }]);
    const [addSubscription, setAddSubscription]   = useState(true);
    const [newPackage, setNewPackage]             = useState("");
    const [newPaymentMethod, setNewPaymentMethod] = useState("");
    const [assignFormsEnabled, setAssignFormsEnabled] = useState(true);
    const [selectedForms, setSelectedForms]       = useState([]);
    const [subDurationMode, setSubDurationMode]   = useState("on_first_plan");
    const [subscriptionStartDate, setSubscriptionStartDate] = useState(null);
    const [txTransactionDate, setTxTransactionDate] = useState(today(getLocalTimeZone()));
    const [txProofFile, setTxProofFile]           = useState(null);
    const [fieldErrors, setFieldErrors]           = useState({}); // { fieldKey: message }
    const [generalError, setGeneralError]         = useState("");  // submit-level error

    // Freeze modal
    const [showFreezeModal, setShowFreezeModal]   = useState(false);
    const [freezingClient, setFreezingClient]     = useState(null);
    const [freezeStartDate, setFreezeStartDate]   = useState("");
    const [freezeDays, setFreezeDays]             = useState("");
    const [freezeNotes, setFreezeNotes]           = useState("");
    const [freezeError, setFreezeError]           = useState("");
    const [freezeSaving, setFreezeSaving]         = useState(false);
    const [unfreezing, setUnfreezing]             = useState(false);

    // Bulk form assignment
    const [selectedIds, setSelectedIds]         = useState(new Set());
    // Full filtered+sorted row set from the table (across all pages) — powers "select all filtered".
    const [filteredClients, setFilteredClients] = useState([]);
    const [showFormPicker, setShowFormPicker]   = useState(false);
    const [pickerForms, setPickerForms]         = useState([]);
    const [assigning, setAssigning]             = useState(false);
    const [sendMode, setSendMode]               = useState("now");
    const [scheduledDate, setScheduledDate]     = useState("");
    const [minBulkScheduleDate, setMinBulkScheduleDate] = useState("");

    // Bulk transaction — record one transaction per selected client
    const [showTxModal, setShowTxModal]                 = useState(false);
    const [bulkTxPackage, setBulkTxPackage]             = useState("");
    const [bulkTxPaymentMethod, setBulkTxPaymentMethod] = useState("");
    const [bulkTxDate, setBulkTxDate]                   = useState(today(getLocalTimeZone()));
    const [bulkTxProof, setBulkTxProof]                 = useState(null);
    const [bulkTxSubMode, setBulkTxSubMode]             = useState("on_first_plan");
    const [bulkTxSubStart, setBulkTxSubStart]           = useState(null);
    const [bulkTxSaving, setBulkTxSaving]               = useState(false);
    const [bulkTxError, setBulkTxError]                 = useState("");

    useEffect(() => {
        Promise.all([
            api.get("/api/clients?page=1&limit=10000"),
            api.get("/api/packages"),
            api.get("/api/payment-methods"),
            api.get("/api/forms"),
        ]).then(([clientRes, pkgRes, pmRes, formsRes]) => {
            setClients(clientRes.data.data ?? []);
            setPackages(pkgRes.data ?? []);
            setPaymentMethods((pmRes.data ?? []).filter(m => m.active));
            setAvailableForms((formsRes.data ?? []).filter(f => f.status === "active" || f.active));
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    // Derived option lists
    const packageOptions = packages.flatMap(p =>
        p.variations.map(v => ({
            value: `${p.name} — ${v.name}`,
            label: `${p.name} — ${v.name}`,
            duration: v.duration,
            price: Number(v.price),
            currency: v.currency,
        }))
    );
    const paymentMethodOptions = paymentMethods.map(m => ({ value: m.name, label: m.name }));
    const formOptions = availableForms.map(f => ({ value: f.id, label: formTitle(f), type: f.type }));

    function updatePhone(index, field, value) {
        setNewPhones(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }

    function addPhone() {
        setNewPhones(prev => (prev.length >= 3 ? prev : [...prev, { countryCode: "+20", number: "" }]));
    }

    function removePhone(index) {
        setNewPhones(prev => prev.filter((_, i) => i !== index));
    }

    // --- WIZARD STEPS ---
    const WIZARD_STEPS = [
        { key: "account",      title: t('stepAccountTitle'),      description: t('stepAccountDesc') },
        { key: "subscription", title: t('stepSubscriptionTitle'), description: t('stepSubscriptionDesc') },
        { key: "data",         title: t('stepDataTitle'),         description: t('stepDataDesc') },
        { key: "review",       title: t('stepReviewTitle'),       description: t('stepReviewDesc') },
    ];
    const isLastStep = currentStep === WIZARD_STEPS.length - 1;

    function resetForm() {
        setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewPassword(generatePassword());
        setShowPassword(false);
        setNewPhones([{ countryCode: "+20", number: "" }]);
        setAddSubscription(true);
        setNewPackage(""); setNewPaymentMethod("");
        setAssignFormsEnabled(true); setSelectedForms([]);
        setSubDurationMode("on_first_plan"); setSubscriptionStartDate(null);
        setTxTransactionDate(today(getLocalTimeZone())); setTxProofFile(null);
        setFieldErrors({}); setGeneralError(""); setCurrentStep(0);
    }

    function clearErrors() {
        setFieldErrors({});
        setGeneralError("");
    }

    // Validate the fields belonging to a given wizard step. Returns a { fieldKey: message } map.
    function validateStep(step) {
        const errors = {};
        if (step === 0) {
            if (!newFirstName.trim()) errors.firstName = t('validationFirstName');

            const emailNorm = newEmail.trim().toLowerCase();
            if (!newEmail.trim() || !EMAIL_REGEX.test(newEmail)) {
                errors.email = t('validationEmail');
            } else if (clients.some(c => (c.email || "").trim().toLowerCase() === emailNorm)) {
                // Duplicate already present in this workspace (server re-checks authoritatively).
                errors.email = t('validationDuplicateEmail');
            }

            if (!newPassword.trim()) errors.password = t('validationPassword');

            const primary = newPhones[0];
            const primaryText = `${primary.countryCode || ""} ${primary.number.trim()}`.trim();
            if (!primary.number.trim() || !PHONE_REGEX.test(primary.number)) {
                errors.phone0 = t('validationPrimaryPhone');
            } else if (clients.some(c => {
                const cp = Array.isArray(c.phones) && c.phones[0]
                    ? `${c.phones[0].countryCode || ""} ${c.phones[0].number || ""}`.trim()
                    : (c.phone || "").trim();
                return cp && cp === primaryText;
            })) {
                errors.phone0 = t('validationDuplicatePhone');
            }

            for (let i = 1; i < newPhones.length; i++) {
                if (newPhones[i].number.trim() && !PHONE_REGEX.test(newPhones[i].number))
                    errors[`phone${i}`] = t('validationPhoneN', { n: i + 1 });
            }
        }
        if (step === 1 && addSubscription) {
            if (!newPackage) errors.package = t('validationPackage');
            if (!newPaymentMethod) errors.paymentMethod = t('validationPaymentMethod');
            if (!txTransactionDate) errors.transactionDate = t('validationTransactionDate');
            if (subDurationMode === "custom" && !subscriptionStartDate) errors.subscriptionStartDate = t('validationSubscriptionDate');
        }
        return errors;
    }

    function goNext() {
        // Full validation of the current step only — highlight every violating field
        // before proceeding to the next step.
        const errors = validateStep(currentStep);
        if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
        clearErrors();
        setCurrentStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1));
    }

    function goBack() {
        clearErrors();
        setCurrentStep(s => Math.max(s - 1, 0));
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        if (!isLastStep) { goNext(); return; }
        handleAddClient();
    }

    async function openAddClientForm() {
        try {
            const { data } = await api.get('/api/clients/limit-check');
            if (!data.allowed) {
                setClientLimitModal({ limit: data.limit });
                return;
            }
        } catch {
            // if check fails, let the form open and handle errors on submit
        }
        resetForm();
        setShowForm(true);
    }

    async function handleAddClient() {
        // Final safety net: re-validate every step before submitting and jump back if needed.
        const accountErrors = validateStep(0);
        const subscriptionErrors = validateStep(1);
        const hasAccountErrors = Object.keys(accountErrors).length > 0;
        const hasSubscriptionErrors = Object.keys(subscriptionErrors).length > 0;
        if (hasAccountErrors || hasSubscriptionErrors) {
            setCurrentStep(hasAccountErrors ? 0 : 1);
            setFieldErrors({ ...accountErrors, ...subscriptionErrors });
            return;
        }
        clearErrors();

        // Keep the primary phone always; drop any blank optional rows.
        const phonesToSend = newPhones.filter((p, i) => i === 0 || p.number.trim());
        const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();

        try {
            const res = await api.post("/api/clients", {
                fname: newFirstName.trim(),
                lname: newLastName.trim(),
                email: newEmail,
                phones: phonesToSend,
                // Only attach a package when a subscription is being created.
                currentPackage: addSubscription ? newPackage : undefined,
                paymentMethod: addSubscription ? newPaymentMethod : undefined,
                password: newPassword,
            });
            // Without a transaction the client has no active subscription — reflect that
            // optimistically until the list is re-fetched (the API computes the same status).
            const created = addSubscription ? res.data : { ...res.data, subscription_status: "No Subscriptions" };
            setClients(prev => [created, ...prev]);
            if (newPassword) {
                setCredsModal({ email: newEmail, password: newPassword });
                setCredsCopied(false);
            }

            // Subscription is optional — skip the transaction entirely when disabled.
            if (addSubscription) {
                // Upload proof if selected
                let proofImagePath = null;
                if (txProofFile) {
                    try {
                        const fd = new FormData();
                        fd.append("proof", txProofFile);
                        const up = await api.post("/api/transactions/upload-proof", fd);
                        proofImagePath = up.data.path;
                    } catch (err) {
                        console.error("Failed to upload proof:", err);
                    }
                }

                // Auto-create transaction
                const selectedPkg = packageOptions.find(pv => pv.value === newPackage);
                if (selectedPkg) {
                    api.post("/api/transactions", {
                        clientId: created.id,
                        clientName: created.name || fullName,
                        packageVariation: newPackage,
                        amount: selectedPkg.price,
                        currency: selectedPkg.currency,
                        duration: selectedPkg.duration,
                        paymentMethod: newPaymentMethod,
                        type: "subscription",
                        status: "completed",
                        date: dateToStr(txTransactionDate),
                        ...(subDurationMode === "custom" && subscriptionStartDate ? { subscriptionStartDate: dateToStr(subscriptionStartDate) } : {}),
                        ...(proofImagePath ? { proofImage: proofImagePath } : {}),
                    }).catch(console.error);
                }
            }

            // Assign forms only when the coach enabled it.
            if (assignFormsEnabled) {
                for (const formId of selectedForms) {
                    api.post("/api/forms/requests", {
                        form_ids: [formId],
                        client_id: created.id,
                        mode: "now",
                        scheduled_at: null,
                    }).catch(console.error);
                }
            }

            resetForm();
            setShowForm(false);
        } catch (err) {
            const msg = err.response?.data?.error || '';
            if (err.response?.status === 403 && msg.startsWith('client_limit_reached:')) {
                const limit = parseInt(msg.split(':')[1]);
                setClientLimitModal({ limit });
            } else if (err.response?.status === 409 && msg === 'duplicate_email') {
                setCurrentStep(0);
                setFieldErrors({ email: t('validationDuplicateEmail') });
            } else if (err.response?.status === 409 && msg === 'duplicate_phone') {
                setCurrentStep(0);
                setFieldErrors({ phone0: t('validationDuplicatePhone') });
            } else {
                setGeneralError(msg || t('failedToCreate'));
            }
        }
    }

    function resetFreezeFields() {
        setFreezeStartDate(todayStr());
        setFreezeDays("");
        setFreezeNotes("");
        setFreezeError("");
    }

    // Bulk freeze: a { bulk: true } marker tells handleFreeze to apply to every selected client.
    function openBulkFreeze() {
        setFreezingClient({ bulk: true });
        resetFreezeFields();
        setShowFreezeModal(true);
    }

    async function handleFreeze(e) {
        e.preventDefault();
        if (!freezeStartDate || !freezeDays || Number(freezeDays) <= 0) {
            setFreezeError(t('validationSubscriptionDate'));
            return;
        }
        const isBulk = !!freezingClient?.bulk;
        const targetIds = isBulk ? [...selectedIds] : [freezingClient.id];
        setFreezeSaving(true);
        try {
            for (const clientId of targetIds) {
                await api.post(`/api/clients/${clientId}/freezes`, {
                    freezeStartDate,
                    freezeDurationDays: Number(freezeDays),
                    notes: freezeNotes || null,
                });
            }
            // Re-fetch to update computed statuses
            const updated = await api.get("/api/clients?page=1&limit=10000");
            setClients(updated.data.data ?? []);
            if (isBulk) setSelectedIds(new Set());
            setShowFreezeModal(false);
        } catch (err) {
            setFreezeError(err.response?.data?.error || "Failed to add freeze.");
        } finally {
            setFreezeSaving(false);
        }
    }

    // Bulk unfreeze: drop the freeze period currently covering today for each selected
    // client (matches the "Frozen" rule on the client detail page). No-op for clients
    // that aren't currently frozen.
    async function handleBulkUnfreeze() {
        if (selectedIds.size === 0) return;
        if (!confirm(t('bulkUnfreezeConfirm', { count: selectedIds.size }))) return;

        const todayMid = new Date();
        todayMid.setHours(0, 0, 0, 0);
        setUnfreezing(true);
        try {
            for (const clientId of [...selectedIds]) {
                const { data } = await api.get(`/api/clients/${clientId}/freezes`);
                const activeFreezes = (data ?? []).filter(f => {
                    const fs = new Date(f.freezeStartDate); fs.setHours(0, 0, 0, 0);
                    const fe = new Date(fs.getTime() + f.freezeDurationDays * 24 * 60 * 60 * 1000);
                    return todayMid >= fs && todayMid < fe;
                });
                for (const f of activeFreezes) {
                    await api.delete(`/api/clients/${clientId}/freezes/${f.id}`);
                }
            }
            // Re-fetch so computed subscription statuses reflect the lifted freezes.
            const updated = await api.get("/api/clients?page=1&limit=10000");
            setClients(updated.data.data ?? []);
            setSelectedIds(new Set());
        } catch (err) {
            console.error(err);
        } finally {
            setUnfreezing(false);
        }
    }

    async function handleBulkAssign() {
        if (pickerForms.length === 0) return;
        if (sendMode === "scheduled" && !scheduledDate) return;
        setAssigning(true);

        try {
            for (const clientId of [...selectedIds]) {
                await api.post("/api/forms/requests", {
                    form_ids: pickerForms,
                    client_id: clientId,
                    mode: sendMode === "scheduled" ? "schedule" : "now",
                    scheduled_at: sendMode === "scheduled" ? new Date(scheduledDate).toISOString() : null,
                });
            }
            setSelectedIds(new Set());
            setShowFormPicker(false);
            setPickerForms([]);
            setSendMode("now");
            setScheduledDate("");
        } catch (err) {
            console.error(err);
        } finally {
            setAssigning(false);
        }
    }

    function openBulkTransaction() {
        setBulkTxPackage("");
        setBulkTxPaymentMethod("");
        setBulkTxDate(today(getLocalTimeZone()));
        setBulkTxProof(null);
        setBulkTxSubMode("on_first_plan");
        setBulkTxSubStart(null);
        setBulkTxError("");
        setShowTxModal(true);
    }

    async function handleBulkTransaction(e) {
        e.preventDefault();
        if (!bulkTxPackage) { setBulkTxError(t('validationPackage')); return; }
        if (!bulkTxPaymentMethod) { setBulkTxError(t('validationPaymentMethod')); return; }
        if (!bulkTxDate) { setBulkTxError(t('validationTransactionDate')); return; }
        if (bulkTxSubMode === "custom" && !bulkTxSubStart) { setBulkTxError(t('validationSubscriptionDate')); return; }

        const selectedPkg = packageOptions.find(pv => pv.value === bulkTxPackage);
        if (!selectedPkg) { setBulkTxError(t('validationPackage')); return; }

        setBulkTxSaving(true);
        try {
            // Upload the proof once and share the path across every client's transaction.
            let proofImagePath = null;
            if (bulkTxProof) {
                const fd = new FormData();
                fd.append("proof", bulkTxProof);
                const up = await api.post("/api/transactions/upload-proof", fd);
                proofImagePath = up.data.path;
            }

            for (const clientId of [...selectedIds]) {
                const client = clients.find(c => c.id === clientId);
                await api.post("/api/transactions", {
                    clientId,
                    clientName: client?.name,
                    packageVariation: bulkTxPackage,
                    amount: selectedPkg.price,
                    currency: selectedPkg.currency,
                    duration: selectedPkg.duration,
                    paymentMethod: bulkTxPaymentMethod,
                    type: "subscription",
                    status: "completed",
                    date: dateToStr(bulkTxDate),
                    ...(bulkTxSubMode === "custom" && bulkTxSubStart ? { subscriptionStartDate: dateToStr(bulkTxSubStart) } : {}),
                    ...(proofImagePath ? { proofImage: proofImagePath } : {}),
                });
            }

            // Re-fetch so computed subscription statuses reflect the new transactions.
            const updated = await api.get("/api/clients?page=1&limit=10000");
            setClients(updated.data.data ?? []);
            setSelectedIds(new Set());
            setShowTxModal(false);
        } catch (err) {
            setBulkTxError(err.response?.data?.error || t('failedToCreate'));
        } finally {
            setBulkTxSaving(false);
        }
    }

    function copyCredsModalCredentials() {
        if (!credsModal) return;
        const text = `Email: ${credsModal.email}\nPassword: ${credsModal.password}`;
        navigator.clipboard.writeText(text).then(() => {
            setCredsCopied(true);
            setTimeout(() => setCredsCopied(false), 2000);
        });
    }

    // Map server clients to DataTable rows
    const clientsData = clients.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        email: c.email,
        phone: Array.isArray(c.phones) && c.phones.length > 0 ? c.phones : (c.phone ? [{ countryCode: "", number: c.phone }] : []),
        phoneSearch: (Array.isArray(c.phones) ? c.phones : []).map(p => `${p.countryCode} ${p.number}`).join(" "),
        currentPackage: c.current_package || "—",
        currentSubscriptionStatus: c.subscription_status || "Active",
        dateCreated: c.created_at,
    }));

    const uniquePackages = [...new Set(clients.map(c => c.current_package).filter(Boolean))];

    const columns = [
        { key: "code", label: t('colCode'), filterType: "text", sortable: true },
        {
            key: "name",
            label: t('colName'),
            filterType: "text",
            sortable: true,
            render: (row) => (
                <Link href={`/${workspaceSlug}/clients/${row.id}`} className="text-primary hover:underline font-medium">
                    {row.name}
                </Link>
            ),
        },
        {
            key: "email",
            label: t('colEmail'),
            filterType: "text",
            sortable: true,
            render: (row) => <span className="text-muted-foreground">{row.email}</span>,
        },
        {
            key: "phoneSearch",
            label: t('colPhone'),
            filterType: "text",
            render: (row) => (
                <div className="flex flex-col gap-0.5">
                    {row.phone.map((p, i) => (
                        <span key={i} className={i === 0 ? "text-foreground" : "text-muted-foreground text-xs"}>
                            {p.countryCode} {p.number}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            key: "currentPackage",
            label: t('colPackage'),
            filterType: "multi",
            options: uniquePackages,
            sortable: true,
        },
        {
            key: "currentSubscriptionStatus",
            label: t('status'),
            filterType: "multi",
            options: ["Active", "Expired", "Frozen", "Pre-start", "No Subscriptions", "Cancelled", "Refunded"],
            sortable: true,
            render: (row) => (
                <Chip size="sm" variant="soft" color={statusChipColor(row.currentSubscriptionStatus)}>
                    {row.currentSubscriptionStatus}
                </Chip>
            ),
        },
        {
            key: "dateCreated",
            label: t('colDateAdded'),
            filterType: "dateRange",
            sortable: true,
            render: (row) => row.dateCreated
                ? new Date(row.dateCreated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                : "—",
        },
    ];

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-foreground mb-6">{t('pageTitle')}</h1>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('pageTitle')}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t('pageDescription')}</p>
            </div>

            {/* Add Client Wizard Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={t('addClientTitle')} dialogClassName="max-w-[40.04rem]">
                {/* noValidate: native required-field validation would block submit before our
                    per-step validateStep() runs; we own validation/highlighting in JS. */}
                <form onSubmit={handleFormSubmit} noValidate className="flex gap-6 px-1 py-1">
                    {/* Vertical stepper (left column) */}
                    <div className="w-44 shrink-0 pt-1">
                        <Stepper steps={WIZARD_STEPS} current={currentStep} orientation="vertical" onStepClick={(i) => { clearErrors(); setCurrentStep(i); }} />
                    </div>

                    {/* Step content (right column) */}
                    <div className="flex min-w-0 flex-1 flex-col gap-5">
                    {/* Submit-level error */}
                    {generalError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{generalError}</p>
                        </div>
                    )}

                    {/* STEP 1 — Create Account */}
                    {currentStep === 0 && (
                        <div className="flex flex-col gap-3">
                            {/* First name + Last name */}
                            <div className="flex gap-2">
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <FieldLabel required>{t('firstName')}</FieldLabel>
                                    <TextField variant="secondary" fullWidth isRequired isInvalid={!!fieldErrors.firstName} aria-label={t('firstName')} value={newFirstName} onChange={setNewFirstName}>
                                        <Input type="text" placeholder={t('firstName')} autoFocus />
                                    </TextField>
                                    <FieldErrorText msg={fieldErrors.firstName} />
                                </div>
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <FieldLabel>{t('lastName')}</FieldLabel>
                                    <TextField variant="secondary" fullWidth aria-label={t('lastName')} value={newLastName} onChange={setNewLastName}>
                                        <Input type="text" placeholder={t('lastName')} />
                                    </TextField>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel required>{t('emailAddress')}</FieldLabel>
                                <TextField variant="secondary" fullWidth isRequired isInvalid={!!fieldErrors.email} aria-label={t('emailAddress')} value={newEmail} onChange={setNewEmail}>
                                    <Input type="email" placeholder={t('emailAddress')} />
                                </TextField>
                                <FieldErrorText msg={fieldErrors.email} />
                            </div>

                            {/* Password */}
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel required>{t('portalPassword')}</FieldLabel>
                                <div className="flex gap-2">
                                    <InputGroup variant="secondary" className={`flex-1${fieldErrors.password ? " ring-1 ring-destructive rounded-lg" : ""}`}>
                                        <InputGroup.Input
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                        <InputGroup.Suffix>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label={showPassword ? tCommon('hide') : tCommon('show')}
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showPassword ? (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </InputGroup.Suffix>
                                    </InputGroup>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="shrink-0 whitespace-nowrap"
                                        onClick={() => { setNewPassword(generatePassword()); setShowPassword(true); }}
                                    >
                                        {t('generate')}
                                    </Button>
                                </div>
                                <FieldErrorText msg={fieldErrors.password} />
                            </div>

                            {/* Phone numbers */}
                            <div className="flex flex-col gap-3">
                                {newPhones.map((phone, i) => {
                                    const isPrimary = i === 0;
                                    const phoneLabel = isPrimary ? t('primaryPhoneLabel') : t('additionalPhoneLabel', { n: i + 1 });
                                    const phoneError = fieldErrors[`phone${i}`];
                                    return (
                                        <div key={i} className="flex flex-col gap-1.5">
                                            <FieldLabel required={isPrimary}>{phoneLabel}</FieldLabel>
                                            <div className="flex gap-2 items-center">
                                                <CountryCodeSelect value={phone.countryCode} onChange={(code) => updatePhone(i, "countryCode", code)} />
                                                <TextField variant="secondary" fullWidth isInvalid={!!phoneError} aria-label={phoneLabel} value={phone.number} onChange={(val) => updatePhone(i, "number", val)} className="flex-1">
                                                    <Input type="text" inputMode="numeric" placeholder={phoneLabel} />
                                                </TextField>
                                                {!isPrimary && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        isIconOnly
                                                        aria-label={t('removePhone')}
                                                        className="shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removePhone(i)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            <FieldErrorText msg={phoneError} />
                                        </div>
                                    );
                                })}
                                {newPhones.length < 3 && (
                                    <Button type="button" variant="ghost" size="sm" onClick={addPhone} className="self-end">
                                        {t('addAnotherPhone')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2 — Add Subscription */}
                    {currentStep === 1 && (
                        <div className="flex flex-col gap-4">
                            {/* Toggle: subscription is optional */}
                            <Switch isSelected={addSubscription} onChange={setAddSubscription}>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                                <Switch.Content>
                                    <Label className="text-sm">{t('addSubscriptionToggle')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('addSubscriptionHint')}</p>
                                </Switch.Content>
                            </Switch>

                            <Separator />

                            {!addSubscription && (
                                <EmptyStateNote icon={CreditCard} title={t('noSubscriptionTitle')} description={t('noSubscriptionNote')} />
                            )}

                            {addSubscription && (
                                <div className="flex flex-col gap-3">
                                    {/* Package Variation */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <FieldLabel required>{t('packageVariationLabel')}</FieldLabel>
                                            <UILink href={`/${workspaceSlug}/finance/packages`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                                                {t('managePackagesShortcut')}
                                                <UILink.Icon />
                                            </UILink>
                                        </div>
                                        <Select variant="secondary" fullWidth isRequired isInvalid={!!fieldErrors.package} placeholder={t('selectPackagePlaceholder')} value={newPackage} onChange={setNewPackage}>
                                            <Select.Trigger>
                                                <Select.Value />
                                                <Select.Indicator />
                                            </Select.Trigger>
                                            <Select.Popover>
                                                <ListBox>
                                                    {packageOptions.map(pv => (
                                                        <ListBox.Item key={pv.value} id={pv.value} textValue={pv.label}>
                                                            {pv.label} — {pv.duration} days, {pv.price.toLocaleString()} {pv.currency}
                                                            <ListBox.ItemIndicator />
                                                        </ListBox.Item>
                                                    ))}
                                                </ListBox>
                                            </Select.Popover>
                                        </Select>
                                        <FieldErrorText msg={fieldErrors.package} />
                                    </div>

                                    {/* Payment Method */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <FieldLabel required>{t('paymentMethodLabel')}</FieldLabel>
                                            <UILink href={`/${workspaceSlug}/finance/payment-methods`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                                                {t('managePaymentMethodsShortcut')}
                                                <UILink.Icon />
                                            </UILink>
                                        </div>
                                        <Select variant="secondary" fullWidth isRequired isInvalid={!!fieldErrors.paymentMethod} placeholder={t('selectPaymentMethodPlaceholder')} value={newPaymentMethod} onChange={setNewPaymentMethod}>
                                            <Select.Trigger>
                                                <Select.Value />
                                                <Select.Indicator />
                                            </Select.Trigger>
                                            <Select.Popover>
                                                <ListBox>
                                                    {paymentMethodOptions.map(pm => (
                                                        <ListBox.Item key={pm.value} id={pm.value} textValue={pm.label}>
                                                            {pm.label}
                                                            <ListBox.ItemIndicator />
                                                        </ListBox.Item>
                                                    ))}
                                                </ListBox>
                                            </Select.Popover>
                                        </Select>
                                        <FieldErrorText msg={fieldErrors.paymentMethod} />
                                    </div>

                                    {/* Transaction Date */}
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel required>{t('transactionDate')}</FieldLabel>
                                        <DatePickerField value={txTransactionDate} onChange={setTxTransactionDate} ariaLabel={t('transactionDate')} isInvalid={!!fieldErrors.transactionDate} />
                                        <FieldErrorText msg={fieldErrors.transactionDate} />
                                    </div>

                                    {/* Proof of Payment */}
                                    <div className="flex flex-col gap-1.5">
                                        <Label>{t('proofOfPayment')} <span className="font-normal opacity-60">{t('proofOptional')}</span></Label>
                                        <ProofDropZone file={txProofFile} onChange={setTxProofFile} />
                                    </div>

                                    {/* Subscription Start — toggle "on first plan"; the date picker stays
                                        visible but is disabled while "on first plan" is selected. */}
                                    <div className="flex flex-col gap-2">
                                        <Label>{t('subscriptionStarts')}</Label>
                                        <Switch
                                            isSelected={subDurationMode === "on_first_plan"}
                                            onChange={(sel) => setSubDurationMode(sel ? "on_first_plan" : "custom")}
                                        >
                                            <Switch.Control>
                                                <Switch.Thumb />
                                            </Switch.Control>
                                            <Switch.Content>
                                                <Label className="text-sm">{t('onFirstPlan')}</Label>
                                            </Switch.Content>
                                        </Switch>
                                        <p className="text-xs text-muted-foreground">
                                            {subDurationMode === "on_first_plan"
                                                ? t('subscriptionStartHintOnFirstPlan')
                                                : t('subscriptionStartHintCustom')}
                                        </p>
                                        <DatePickerField
                                            value={subscriptionStartDate}
                                            onChange={setSubscriptionStartDate}
                                            ariaLabel={t('subscriptionStarts')}
                                            isDisabled={subDurationMode === "on_first_plan"}
                                            isInvalid={!!fieldErrors.subscriptionStartDate}
                                        />
                                        <FieldErrorText msg={fieldErrors.subscriptionStartDate} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3 — Collect Data */}
                    {currentStep === 2 && (
                        <div className="flex flex-col gap-4">
                            {/* Toggle: assigning forms is optional */}
                            <Switch isSelected={assignFormsEnabled} onChange={setAssignFormsEnabled}>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                                <Switch.Content>
                                    <Label className="text-sm">{t('assignFormsToggle')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('stepDataHint')}</p>
                                </Switch.Content>
                            </Switch>

                            <Separator />

                            {!assignFormsEnabled && (
                                <EmptyStateNote icon={ClipboardList} title={t('noFormsTitle')} description={t('noFormsNote')} />
                            )}

                            {assignFormsEnabled && (
                                <Select
                                    variant="secondary"
                                    fullWidth
                                    selectionMode="multiple"
                                    placeholder={t('selectFormsPlaceholder')}
                                    value={selectedForms}
                                    onChange={setSelectedForms}
                                >
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {formOptions.map(f => (
                                                <ListBox.Item key={f.value} id={f.value} textValue={f.label}>
                                                    {f.label}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            )}
                        </div>
                    )}

                    {/* STEP 4 — Review */}
                    {currentStep === 3 && (
                        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                            <ReviewRow label={t('reviewName')} value={`${newFirstName} ${newLastName}`.trim() || "—"} />
                            <ReviewRow label={t('emailFieldLabel')} value={newEmail || "—"} />
                            <ReviewRow label={t('passwordFieldLabel')} value={newPassword || "—"} mono />
                            <ReviewRow
                                label={t('phoneNumbers')}
                                value={
                                    newPhones
                                        .filter(p => p.number.trim())
                                        .map(p => `${p.countryCode} ${p.number}`)
                                        .join(", ") || "—"
                                }
                            />
                            {addSubscription ? (
                                <>
                                    <ReviewRow label={t('packageVariationLabel')} value={newPackage || "—"} />
                                    <ReviewRow label={t('paymentMethodLabel')} value={newPaymentMethod || "—"} />
                                    <ReviewRow label={t('transactionDate')} value={dateToStr(txTransactionDate) || "—"} />
                                    <ReviewRow
                                        label={t('subscriptionStarts')}
                                        value={subDurationMode === "custom" ? (dateToStr(subscriptionStartDate) || "—") : t('onFirstPlan')}
                                    />
                                    <ReviewRow label={t('proofOfPayment')} value={txProofFile ? txProofFile.name : t('reviewNone')} />
                                </>
                            ) : (
                                <ReviewRow label={t('reviewSubscription')} value={t('reviewNoSubscription')} />
                            )}
                            <ReviewRow
                                label={t('assignFormsLabel')}
                                value={
                                    assignFormsEnabled && selectedForms.length > 0
                                        ? selectedForms.map(id => formOptions.find(f => f.value === id)?.label || id).join(", ")
                                        : t('reviewNone')
                                }
                            />
                        </div>
                    )}

                    {/* Wizard footer */}
                    <ModalFooter>
                        {currentStep > 0 && (
                            <Button type="button" variant="ghost" onClick={goBack}>
                                {t('wizardBack')}
                            </Button>
                        )}
                        <Button type="submit" variant="primary">
                            {isLastStep ? t('addClient') : t('wizardNext')}
                        </Button>
                    </ModalFooter>
                    </div>
                </form>
            </Modal>

            {/* One-time credentials reveal modal */}
            <Modal open={!!credsModal} onClose={() => setCredsModal(null)} title={t('clientCreatedTitle')}>
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        {t('savePasswordWarning')}
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium">{t('emailFieldLabel')}</span>
                        <span className="text-sm font-mono text-foreground">{credsModal?.email}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium">{t('passwordFieldLabel')}</span>
                        <span className="text-sm font-mono text-foreground">{credsModal?.password}</span>
                    </div>
                    <button
                        onClick={copyCredsModalCredentials}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors cursor-pointer self-start"
                    >
                        {credsCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        {credsCopied ? t('copied') : t('copyCredentials')}
                    </button>
                </div>
            </Modal>

            {/* Table */}
            <DataTable
                columns={columns}
                data={clientsData}
                rowKey="id"
                dateParser={(str) => new Date(str)}
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onFilteredDataChange={setFilteredClients}
                defaultSort="dateCreated"
                defaultSortDirection="desc"
                quickSearch={{
                    fields: ["code", "name", "email", "phoneSearch"],
                    placeholder: t('searchClients'),
                }}
                toolbarEnd={
                    <Button variant="primary" onClick={openAddClientForm}>
                        + {t('addClient')}
                    </Button>
                }
            />

            {/* Floating bulk action bar */}
            <ActionBar isOpen={selectedIds.size > 0} aria-label={t('clientsSelectedBar', { count: selectedIds.size })}>
                <ActionBar.Prefix>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-default px-1.5 text-xs font-semibold text-foreground">
                        {selectedIds.size}
                    </span>
                    {filteredClients.length > selectedIds.size && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds(new Set(filteredClients.map(r => r.id)))}
                        >
                            <ListChecks className="w-4 h-4" />
                            <span className="action-bar__label">{t('selectAllFiltered', { count: filteredClients.length })}</span>
                        </Button>
                    )}
                </ActionBar.Prefix>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Content>
                    <Button variant="ghost" size="sm" onClick={openBulkTransaction}>
                        <CreditCard className="w-4 h-4" />
                        <span className="action-bar__label">{t('newTransactionBulk')}</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={openBulkFreeze}>
                        <Snowflake className="w-4 h-4" />
                        <span className="action-bar__label">{t('freeze')}</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleBulkUnfreeze} isDisabled={unfreezing}>
                        <Sun className="w-4 h-4" />
                        <span className="action-bar__label">{t('unfreeze')}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setShowFormPicker(true);
                            setPickerForms([]);
                            setSendMode("now");
                            setScheduledDate("");
                            setMinBulkScheduleDate(new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16));
                        }}
                    >
                        <FileText className="w-4 h-4" />
                        <span className="action-bar__label">{t('requestFormBulk')}</span>
                    </Button>
                </ActionBar.Content>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Suffix>
                    <Tooltip>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('clearSelection')}
                            onClick={() => setSelectedIds(new Set())}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        <Tooltip.Content>{t('clearSelection')}</Tooltip.Content>
                    </Tooltip>
                </ActionBar.Suffix>
            </ActionBar>

            {/* Freeze Modal */}
            <Modal
                open={showFreezeModal}
                onClose={() => setShowFreezeModal(false)}
                title={freezingClient?.bulk
                    ? t('freezeSubscriptionTitle')
                    : `${t('freezeSubscriptionTitle')} — ${freezingClient?.name ?? ""}`}
            >
                <form onSubmit={handleFreeze} className="flex flex-col gap-3">
                    {freezingClient?.bulk && (
                        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                            {t('bulkFreezeHint', { count: selectedIds.size })}
                        </p>
                    )}
                    {freezeError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{freezeError}</p>
                        </div>
                    )}
                    <div>
                        <label className="text-muted-foreground text-xs font-medium">{t('freezeStartDate')} *</label>
                        <input
                            type="date"
                            value={freezeStartDate}
                            onChange={e => setFreezeStartDate(e.target.value)}
                            className={`${inputCls} mt-1`}
                        />
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs font-medium">{t('freezeDurationLabel')} *</label>
                        <input
                            type="number"
                            min="1"
                            placeholder="e.g. 14"
                            value={freezeDays}
                            onChange={e => setFreezeDays(e.target.value)}
                            className={`${inputCls} mt-1`}
                        />
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs font-medium">{t('freezeNotesLabel')} <span className="font-normal opacity-60">{t('proofOptional')}</span></label>
                        <textarea
                            rows={2}
                            value={freezeNotes}
                            onChange={e => setFreezeNotes(e.target.value)}
                            placeholder={t('freezeReason')}
                            className={`${inputCls} resize-none mt-1`}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        fullWidth
                        isDisabled={freezeSaving}
                    >
                        {freezeSaving ? t('saving') : t('addFreeze')}
                    </Button>
                </form>
            </Modal>

            {/* Client limit reached modal */}
            <Modal
                open={!!clientLimitModal}
                onClose={() => setClientLimitModal(null)}
                title={t('clientLimitTitle')}
            >
                <div className="flex flex-col gap-5">
                    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                        <span className="text-amber-500 mt-0.5 text-base leading-none">⚠</span>
                        <div>
                            <p className="text-sm font-medium text-amber-600">
                                {t('clientLimitMessage', { limit: clientLimitModal?.limit ?? 0 })}
                            </p>
                            <p className="text-xs text-amber-600/70 mt-0.5">
                                {t('clientLimitUpgrade')}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">
                            {t('clientLimitContact')}
                        </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setClientLimitModal(null)}>
                            {t('dismiss')}
                        </Button>
                        <Button variant="primary" onClick={() => { setClientLimitModal(null); window.location.href = `/${workspaceSlug}/settings?tab=billing`; }}>
                            {t('upgradePlan')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Bulk transaction modal — records one transaction per selected client */}
            <Modal open={showTxModal} onClose={() => setShowTxModal(false)} title={t('bulkTransactionTitle')} dialogClassName="max-w-[27.3rem]">
                <form onSubmit={handleBulkTransaction} className="flex flex-col gap-4 px-1 py-1">
                    <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                        {t('bulkTransactionHint', { count: selectedIds.size })}
                    </p>

                    {bulkTxError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{bulkTxError}</p>
                        </div>
                    )}

                    {/* Package Variation */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel required>{t('packageVariationLabel')}</FieldLabel>
                            <UILink href={`/${workspaceSlug}/finance/packages`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                                {t('managePackagesShortcut')}
                                <UILink.Icon />
                            </UILink>
                        </div>
                        <Select variant="secondary" fullWidth placeholder={t('selectPackagePlaceholder')} value={bulkTxPackage} onChange={setBulkTxPackage}>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {packageOptions.map(pv => (
                                        <ListBox.Item key={pv.value} id={pv.value} textValue={pv.label}>
                                            {pv.label} — {pv.duration} days, {pv.price.toLocaleString()} {pv.currency}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel required>{t('paymentMethodLabel')}</FieldLabel>
                            <UILink href={`/${workspaceSlug}/finance/payment-methods`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                                {t('managePaymentMethodsShortcut')}
                                <UILink.Icon />
                            </UILink>
                        </div>
                        <Select variant="secondary" fullWidth placeholder={t('selectPaymentMethodPlaceholder')} value={bulkTxPaymentMethod} onChange={setBulkTxPaymentMethod}>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {paymentMethodOptions.map(pm => (
                                        <ListBox.Item key={pm.value} id={pm.value} textValue={pm.label}>
                                            {pm.label}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>

                    {/* Transaction Date */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('transactionDate')}</FieldLabel>
                        <DatePickerField value={bulkTxDate} onChange={setBulkTxDate} ariaLabel={t('transactionDate')} />
                    </div>

                    {/* Proof of Payment */}
                    <div className="flex flex-col gap-1.5">
                        <Label>{t('proofOfPayment')} <span className="font-normal opacity-60">{t('proofOptional')}</span></Label>
                        <ProofDropZone file={bulkTxProof} onChange={setBulkTxProof} />
                    </div>

                    {/* Subscription Start — "on first plan" queues after each client's current plan. */}
                    <div className="flex flex-col gap-2">
                        <Label>{t('subscriptionStarts')}</Label>
                        <Switch
                            isSelected={bulkTxSubMode === "on_first_plan"}
                            onChange={(sel) => setBulkTxSubMode(sel ? "on_first_plan" : "custom")}
                        >
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                                <Label className="text-sm">{t('onFirstPlan')}</Label>
                            </Switch.Content>
                        </Switch>
                        <p className="text-xs text-muted-foreground">
                            {bulkTxSubMode === "on_first_plan"
                                ? t('subscriptionStartHintOnFirstPlan')
                                : t('subscriptionStartHintCustom')}
                        </p>
                        <DatePickerField
                            value={bulkTxSubStart}
                            onChange={setBulkTxSubStart}
                            ariaLabel={t('subscriptionStarts')}
                            isDisabled={bulkTxSubMode === "on_first_plan"}
                        />
                    </div>

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => setShowTxModal(false)}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary" isDisabled={bulkTxSaving}>
                            {bulkTxSaving ? t('saving') : t('recordTransactionBulk', { count: selectedIds.size })}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Bulk form picker modal */}
            <Modal open={showFormPicker} onClose={() => setShowFormPicker(false)} title={t('requestFormsTitle')}>
                <div className="flex flex-col gap-4">
                    <p className="text-muted-foreground text-sm">
                        {t('chooseFormsFor', { count: selectedIds.size })}
                    </p>

                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                        {availableForms.length === 0 ? (
                            <p className="text-muted-foreground text-sm">{t('noActiveFormsAvailable')}</p>
                        ) : (
                            availableForms.map(form => {
                                const isChecked = pickerForms.includes(form.id);
                                return (
                                    <button
                                        key={form.id}
                                        type="button"
                                        onClick={() => setPickerForms(prev => isChecked ? prev.filter(f => f !== form.id) : [...prev, form.id])}
                                        className={`w-full px-3 py-2.5 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                                            isChecked
                                                ? "bg-primary/10 text-primary border border-primary/30"
                                                : "bg-background text-foreground hover:bg-default border border-transparent"
                                        }`}
                                    >
                                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                            isChecked ? "bg-primary border-primary" : "border-border"
                                        }`}>
                                            {isChecked && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className="flex-1">{formTitle(form)}</span>
                                        {form.type && (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                form.type === "assessment" ? "bg-accent/15 text-accent" : "bg-purple-500/15 text-purple-600"
                                            }`}>
                                                {form.type === "assessment" ? t('assessment') : t('checkin')}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Send mode */}
                    <div className="flex flex-col gap-3 border-t border-border pt-4">
                        <span className="text-muted-foreground text-xs font-medium">{t('whenToSend')}</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSendMode("now")}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                    sendMode === "now"
                                        ? "bg-primary/10 text-primary border border-primary/30"
                                        : "bg-background text-muted-foreground hover:text-foreground border border-transparent"
                                }`}
                            >
                                {t('sendNow')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSendMode("scheduled")}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                    sendMode === "scheduled"
                                        ? "bg-accent/15 text-accent border border-accent/20"
                                        : "bg-background text-muted-foreground hover:text-foreground border border-transparent"
                                }`}
                            >
                                {t('scheduleForms')}
                            </button>
                        </div>
                        {sendMode === "scheduled" && (
                            <input
                                type="datetime-local"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                min={minBulkScheduleDate}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                            />
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowFormPicker(false)}>
                            {tCommon('cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleBulkAssign}
                            isDisabled={pickerForms.length === 0 || assigning || (sendMode === "scheduled" && !scheduledDate)}
                        >
                            {assigning
                                ? t('assigningForms')
                                : sendMode === "scheduled"
                                    ? (pickerForms.length > 0 ? t('scheduleCount', { count: pickerForms.length }) : t('scheduleForms'))
                                    : (pickerForms.length > 0 ? t('assignCount', { count: pickerForms.length }) : t('assignCount', { count: 0 }))
                            }
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
