"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";

// --- HELPERS ---
function statusColor(status) {
    switch (status) {
        case "Active":           return "bg-green-100 text-green-600";
        case "Expired":          return "bg-red-50 text-destructive";
        case "Frozen":           return "bg-blue-50 text-blue-600";
        case "Pre-start":        return "bg-yellow-50 text-yellow-600";
        case "No Subscriptions": return "bg-secondary text-muted-foreground";
        case "Cancelled":        return "bg-secondary text-muted-foreground";
        case "Refunded":         return "bg-purple-50 text-purple-600";
        default:                 return "bg-secondary text-muted-foreground";
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

// --- COUNTRY CODES ---
const COUNTRY_CODES = [
    { code: "+93", name: "Afghanistan" }, { code: "+355", name: "Albania" }, { code: "+213", name: "Algeria" },
    { code: "+376", name: "Andorra" }, { code: "+244", name: "Angola" }, { code: "+54", name: "Argentina" },
    { code: "+374", name: "Armenia" }, { code: "+61", name: "Australia" }, { code: "+43", name: "Austria" },
    { code: "+994", name: "Azerbaijan" }, { code: "+973", name: "Bahrain" }, { code: "+880", name: "Bangladesh" },
    { code: "+375", name: "Belarus" }, { code: "+32", name: "Belgium" }, { code: "+55", name: "Brazil" },
    { code: "+1", name: "Canada / USA" }, { code: "+86", name: "China" }, { code: "+57", name: "Colombia" },
    { code: "+385", name: "Croatia" }, { code: "+357", name: "Cyprus" }, { code: "+420", name: "Czech Republic" },
    { code: "+45", name: "Denmark" }, { code: "+20", name: "Egypt" }, { code: "+358", name: "Finland" },
    { code: "+33", name: "France" }, { code: "+995", name: "Georgia" }, { code: "+49", name: "Germany" },
    { code: "+233", name: "Ghana" }, { code: "+30", name: "Greece" }, { code: "+36", name: "Hungary" },
    { code: "+354", name: "Iceland" }, { code: "+91", name: "India" }, { code: "+62", name: "Indonesia" },
    { code: "+98", name: "Iran" }, { code: "+964", name: "Iraq" }, { code: "+353", name: "Ireland" },
    { code: "+972", name: "Israel" }, { code: "+39", name: "Italy" }, { code: "+81", name: "Japan" },
    { code: "+962", name: "Jordan" }, { code: "+7", name: "Kazakhstan / Russia" }, { code: "+254", name: "Kenya" },
    { code: "+965", name: "Kuwait" }, { code: "+961", name: "Lebanon" }, { code: "+218", name: "Libya" },
    { code: "+60", name: "Malaysia" }, { code: "+960", name: "Maldives" }, { code: "+52", name: "Mexico" },
    { code: "+212", name: "Morocco" }, { code: "+31", name: "Netherlands" }, { code: "+64", name: "New Zealand" },
    { code: "+234", name: "Nigeria" }, { code: "+47", name: "Norway" }, { code: "+968", name: "Oman" },
    { code: "+92", name: "Pakistan" }, { code: "+970", name: "Palestine" }, { code: "+507", name: "Panama" },
    { code: "+63", name: "Philippines" }, { code: "+48", name: "Poland" }, { code: "+351", name: "Portugal" },
    { code: "+974", name: "Qatar" }, { code: "+40", name: "Romania" }, { code: "+250", name: "Rwanda" },
    { code: "+966", name: "Saudi Arabia" }, { code: "+221", name: "Senegal" }, { code: "+381", name: "Serbia" },
    { code: "+65", name: "Singapore" }, { code: "+27", name: "South Africa" }, { code: "+82", name: "South Korea" },
    { code: "+34", name: "Spain" }, { code: "+94", name: "Sri Lanka" }, { code: "+249", name: "Sudan" },
    { code: "+46", name: "Sweden" }, { code: "+41", name: "Switzerland" }, { code: "+963", name: "Syria" },
    { code: "+886", name: "Taiwan" }, { code: "+255", name: "Tanzania" }, { code: "+66", name: "Thailand" },
    { code: "+216", name: "Tunisia" }, { code: "+90", name: "Turkey" }, { code: "+256", name: "Uganda" },
    { code: "+380", name: "Ukraine" }, { code: "+971", name: "United Arab Emirates" }, { code: "+44", name: "United Kingdom" },
    { code: "+1", name: "United States" }, { code: "+998", name: "Uzbekistan" }, { code: "+58", name: "Venezuela" },
    { code: "+84", name: "Vietnam" }, { code: "+967", name: "Yemen" }, { code: "+260", name: "Zambia" },
    { code: "+263", name: "Zimbabwe" },
];

// --- SEARCHABLE COUNTRY CODE DROPDOWN ---
function CountryCodeSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
    );

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-24 px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring truncate transition-colors"
            >
                {value || "+?"}
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-20 w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-[fadeIn_150ms_ease-out]">
                    <input
                        type="text"
                        placeholder="Search country or code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-background border-b border-border text-foreground text-xs placeholder:text-muted-foreground focus-visible:outline-none"
                        autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map((c, i) => (
                            <button
                                key={`${c.code}-${i}`}
                                type="button"
                                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                                className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex justify-between ${
                                    value === c.code
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground hover:bg-accent"
                                }`}
                            >
                                <span>{c.name}</span>
                                <span className="text-muted-foreground">{c.code}</span>
                            </button>
                        ))}
                        {filtered.length === 0 && <p className="px-3 py-2 text-muted-foreground text-xs">No results</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- MULTI-SELECT DROPDOWN (for forms) ---
function MultiSelectDropdown({ options, selected, onChange, placeholder }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function toggle(value) {
        onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`w-full px-4 py-2 rounded-lg bg-background border border-input text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-between transition-colors ${
                    selected.length === 0 ? "text-muted-foreground" : "text-foreground"
                }`}
            >
                <span className="truncate">
                    {selected.length === 0 ? placeholder : `${selected.length} form${selected.length > 1 ? "s" : ""} selected`}
                </span>
                <svg className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.map(val => {
                        const opt = options.find(o => o.value === val);
                        return (
                            <span key={val} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                                {opt?.label || val}
                                <button type="button" onClick={() => toggle(val)} className="hover:text-primary/80 transition-colors">×</button>
                            </span>
                        );
                    })}
                </div>
            )}

            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-[fadeIn_150ms_ease-out]">
                    <div className="max-h-48 overflow-y-auto">
                        {options.length === 0 ? (
                            <p className="px-3 py-2 text-muted-foreground text-xs">No options available</p>
                        ) : (
                            options.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => toggle(opt.value)}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                        selected.includes(opt.value)
                                            ? "bg-primary/10 text-primary"
                                            : "text-foreground hover:bg-accent"
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                        selected.includes(opt.value)
                                            ? "bg-primary border-primary"
                                            : "border-border"
                                    }`}>
                                        {selected.includes(opt.value) && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className="flex-1">{opt.label}</span>
                                    {opt.type && (
                                        <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            opt.type === "assessment" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                        }`}>
                                            {opt.type === "assessment" ? "Assessment" : "Check-in"}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- PAGE ---
export default function ClientsPage() {
    const { workspaceSlug } = useParams();
    const [clients, setClients]           = useState([]);
    const [packages, setPackages]         = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [availableForms, setAvailableForms] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [credsModal, setCredsModal]     = useState(null); // { email, password } | null
    const [credsCopied, setCredsCopied]   = useState(false);

    // Add-client modal
    const [showForm, setShowForm]             = useState(false);
    const [newFirstName, setNewFirstName]     = useState("");
    const [newLastName, setNewLastName]       = useState("");
    const [newEmail, setNewEmail]             = useState("");
    const [newPassword, setNewPassword]       = useState(generatePassword());
    const [showPassword, setShowPassword]     = useState(false);
    const [phoneCount, setPhoneCount]         = useState(1);
    const [newPhones, setNewPhones]           = useState([
        { countryCode: "+20", number: "" },
        { countryCode: "+20", number: "" },
        { countryCode: "+20", number: "" },
    ]);
    const [newPackage, setNewPackage]             = useState("");
    const [newPaymentMethod, setNewPaymentMethod] = useState("");
    const [selectedForms, setSelectedForms]       = useState([]);
    const [subDurationMode, setSubDurationMode]   = useState("on_first_plan");
    const [subscriptionStartDate, setSubscriptionStartDate] = useState("");
    const [txTransactionDate, setTxTransactionDate] = useState(todayStr());
    const [txProofFile, setTxProofFile]           = useState(null);
    const [formErrors, setFormErrors]             = useState([]);

    // Freeze modal
    const [showFreezeModal, setShowFreezeModal]   = useState(false);
    const [freezingClient, setFreezingClient]     = useState(null);
    const [freezeStartDate, setFreezeStartDate]   = useState("");
    const [freezeDays, setFreezeDays]             = useState("");
    const [freezeNotes, setFreezeNotes]           = useState("");
    const [freezeError, setFreezeError]           = useState("");
    const [freezeSaving, setFreezeSaving]         = useState(false);

    // Bulk form assignment
    const [selectedIds, setSelectedIds]         = useState(new Set());
    const [showFormPicker, setShowFormPicker]   = useState(false);
    const [pickerForms, setPickerForms]         = useState([]);
    const [assigning, setAssigning]             = useState(false);
    const [sendMode, setSendMode]               = useState("now");
    const [scheduledDate, setScheduledDate]     = useState("");

    useEffect(() => {
        Promise.all([
            api.get("/api/clients"),
            api.get("/api/packages"),
            api.get("/api/payment-methods"),
            api.get("/api/forms"),
        ]).then(([clientRes, pkgRes, pmRes, formsRes]) => {
            setClients(clientRes.data ?? []);
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
    const formOptions = availableForms.map(f => ({ value: f.id, label: f.title, type: f.type }));

    function updatePhone(index, field, value) {
        setNewPhones(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }

    function resetForm() {
        setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewPassword(generatePassword());
        setShowPassword(false); setPhoneCount(1);
        setNewPhones([{ countryCode: "+20", number: "" }, { countryCode: "+20", number: "" }, { countryCode: "+20", number: "" }]);
        setNewPackage(""); setNewPaymentMethod(""); setSelectedForms([]);
        setSubDurationMode("on_first_plan"); setSubscriptionStartDate("");
        setTxTransactionDate(todayStr()); setTxProofFile(null);
        setFormErrors([]);
    }

    function validateForm() {
        const errors = [];
        if (!newFirstName.trim()) errors.push("First name is required");
        if (!newEmail.trim() || !EMAIL_REGEX.test(newEmail)) errors.push("Valid email is required");
        if (!newPhones[0].number.trim() || !PHONE_REGEX.test(newPhones[0].number)) errors.push("Primary phone must be 7–15 digits");
        for (let i = 1; i < phoneCount; i++) {
            if (newPhones[i].number.trim() && !PHONE_REGEX.test(newPhones[i].number))
                errors.push(`Phone ${i + 1} must be 7–15 digits`);
        }
        if (!newPackage) errors.push("Package variation is required");
        if (!newPaymentMethod) errors.push("Payment method is required");
        if (subDurationMode === "custom" && !subscriptionStartDate) errors.push("Subscription start date is required");
        return errors;
    }

    async function handleAddClient(e) {
        e.preventDefault();
        const errors = validateForm();
        if (errors.length > 0) { setFormErrors(errors); return; }
        setFormErrors([]);

        const phonesToSend = newPhones.slice(0, phoneCount);
        const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();

        try {
            const res = await api.post("/api/clients", {
                fname: newFirstName.trim(),
                lname: newLastName.trim(),
                email: newEmail,
                phones: phonesToSend,
                currentPackage: newPackage,
                paymentMethod: newPaymentMethod,
                password: newPassword,
            });
            const created = res.data;
            setClients(prev => [created, ...prev]);
            if (created.tempPassword) {
                setCredsModal({ email: newEmail, password: created.tempPassword });
                setCredsCopied(false);
            }

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
                    date: txTransactionDate,
                    ...(subDurationMode === "custom" && subscriptionStartDate ? { subscriptionStartDate } : {}),
                    ...(proofImagePath ? { proofImage: proofImagePath } : {}),
                }).catch(console.error);
            }

            // Assign forms
            for (const formId of selectedForms) {
                api.post("/api/forms/requests", {
                    form_ids: [formId],
                    client_id: created.id,
                    mode: "now",
                    scheduled_at: null,
                }).catch(console.error);
            }

            resetForm();
            setShowForm(false);
        } catch (err) {
            setFormErrors([err.response?.data?.error || "Failed to create client"]);
        }
    }

    function openFreeze(client) {
        setFreezingClient(client);
        setFreezeStartDate(todayStr());
        setFreezeDays("");
        setFreezeNotes("");
        setFreezeError("");
        setShowFreezeModal(true);
    }

    async function handleFreeze(e) {
        e.preventDefault();
        if (!freezeStartDate || !freezeDays || Number(freezeDays) <= 0) {
            setFreezeError("Start date and duration (days) are required.");
            return;
        }
        setFreezeSaving(true);
        try {
            await api.post(`/api/clients/${freezingClient.id}/freezes`, {
                freezeStartDate,
                freezeDurationDays: Number(freezeDays),
                notes: freezeNotes || null,
            });
            // Re-fetch to update computed statuses
            const updated = await api.get("/api/clients");
            setClients(updated.data ?? []);
            setShowFreezeModal(false);
        } catch (err) {
            setFreezeError(err.response?.data?.error || "Failed to add freeze.");
        } finally {
            setFreezeSaving(false);
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
        { key: "code", label: "Code", filterType: "text", sortable: true },
        {
            key: "name",
            label: "Name",
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
            label: "Email",
            filterType: "text",
            sortable: true,
            render: (row) => <span className="text-muted-foreground">{row.email}</span>,
        },
        {
            key: "phoneSearch",
            label: "Phone",
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
            label: "Package",
            filterType: "multi",
            options: uniquePackages,
            sortable: true,
        },
        {
            key: "currentSubscriptionStatus",
            label: "Status",
            filterType: "multi",
            options: ["Active", "Expired", "Frozen", "Pre-start", "Cancelled", "Refunded"],
            sortable: true,
            render: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(row.currentSubscriptionStatus)}`}>
                    {row.currentSubscriptionStatus}
                </span>
            ),
        },
        {
            key: "dateCreated",
            label: "Date Added",
            filterType: "dateRange",
            sortable: true,
            render: (row) => row.dateCreated
                ? new Date(row.dateCreated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                : "—",
        },
        {
            key: "_actions",
            label: "",
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        onClick={() => openFreeze(row)}
                        title="Freeze subscription"
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                    >
                        Freeze
                    </button>
                </div>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-foreground mb-6">Clients</h1>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-foreground">Clients</h1>
                <Button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    // className="bg-primary hover:bg-primary/90 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                    + Add Client
                </Button>
            </div>

            {/* Add Client Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Add Client">
                <form onSubmit={handleAddClient} className="flex flex-col gap-3">
                    {/* Validation errors */}
                    {formErrors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            {formErrors.map((err, i) => <p key={i} className="text-destructive text-xs">{err}</p>)}
                        </div>
                    )}

                    {/* First name + Last name */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="First name *"
                            value={newFirstName}
                            onChange={(e) => setNewFirstName(e.target.value)}
                            className={`${inputCls} flex-1`}
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder="Last name"
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            className={`${inputCls} flex-1`}
                        />
                    </div>

                    {/* Email */}
                    <input
                        type="email"
                        placeholder="Email address *"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={inputCls}
                    />

                    {/* Password */}
                    <label className="text-muted-foreground text-xs font-medium">Portal Password *</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={`${inputCls} pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                        </div>
                        <button
                            type="button"
                            onClick={() => { setNewPassword(generatePassword()); setShowPassword(true); }}
                            className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                        >
                            Generate
                        </button>
                    </div>

                    {/* Phone numbers */}
                    <label className="text-muted-foreground text-xs font-medium">Phone Numbers</label>
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 items-center">
                            <CountryCodeSelect value={newPhones[0].countryCode} onChange={(code) => updatePhone(0, "countryCode", code)} />
                            <input type="text" placeholder="Primary phone * (required)" value={newPhones[0].number} onChange={(e) => updatePhone(0, "number", e.target.value)} className={`flex-1 ${inputCls}`} />
                        </div>
                        {phoneCount >= 2 && (
                            <div className="flex gap-2 items-center">
                                <CountryCodeSelect value={newPhones[1].countryCode} onChange={(code) => updatePhone(1, "countryCode", code)} />
                                <input type="text" placeholder="Phone 2 (optional)" value={newPhones[1].number} onChange={(e) => updatePhone(1, "number", e.target.value)} className={`flex-1 ${inputCls}`} />
                            </div>
                        )}
                        {phoneCount >= 3 && (
                            <div className="flex gap-2 items-center">
                                <CountryCodeSelect value={newPhones[2].countryCode} onChange={(code) => updatePhone(2, "countryCode", code)} />
                                <input type="text" placeholder="Phone 3 (optional)" value={newPhones[2].number} onChange={(e) => updatePhone(2, "number", e.target.value)} className={`flex-1 ${inputCls}`} />
                            </div>
                        )}
                        {phoneCount < 3 && (
                            <button type="button" onClick={() => setPhoneCount(prev => prev + 1)} className="text-xs text-primary hover:text-primary/80 self-start transition-colors cursor-pointer">
                                + Add another phone
                            </button>
                        )}
                    </div>

                    {/* Package Variation */}
                    <label className="text-muted-foreground text-xs font-medium">Package Variation *</label>
                    <select value={newPackage} onChange={(e) => setNewPackage(e.target.value)} className={`${inputCls} ${!newPackage ? "text-muted-foreground" : ""}`}>
                        <option value="">Select a package variation...</option>
                        {packageOptions.map(pv => (
                            <option key={pv.value} value={pv.value}>
                                {pv.label} — {pv.duration} days, {pv.price.toLocaleString()} {pv.currency}
                            </option>
                        ))}
                    </select>

                    {/* Payment Method */}
                    <label className="text-muted-foreground text-xs font-medium">Payment Method *</label>
                    <select value={newPaymentMethod} onChange={(e) => setNewPaymentMethod(e.target.value)} className={`${inputCls} ${!newPaymentMethod ? "text-muted-foreground" : ""}`}>
                        <option value="">Select a payment method...</option>
                        {paymentMethodOptions.map(pm => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
                    </select>

                    {/* Transaction Date */}
                    <label className="text-muted-foreground text-xs font-medium">Transaction Date</label>
                    <input
                        type="date"
                        value={txTransactionDate}
                        onChange={e => setTxTransactionDate(e.target.value)}
                        className={inputCls}
                    />

                    {/* Proof of Payment */}
                    <label className="text-muted-foreground text-xs font-medium">Proof of Payment <span className="font-normal opacity-60">(optional)</span></label>
                    <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={e => setTxProofFile(e.target.files[0] || null)}
                        className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
                    />
                    {txProofFile && <p className="text-xs text-muted-foreground -mt-1">{txProofFile.name}</p>}

                    {/* Subscription Start */}
                    <label className="text-muted-foreground text-xs font-medium">Subscription Starts</label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setSubDurationMode("on_first_plan")}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                subDurationMode === "on_first_plan"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                        >
                            On First Plan
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubDurationMode("custom")}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                subDurationMode === "custom"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                        >
                            Custom Date
                        </button>
                    </div>
                    {subDurationMode === "custom" && (
                        <input
                            type="date"
                            value={subscriptionStartDate}
                            onChange={(e) => setSubscriptionStartDate(e.target.value)}
                            className={inputCls}
                        />
                    )}

                    {/* Assign Forms */}
                    <label className="text-muted-foreground text-xs font-medium">Assign Forms (optional)</label>
                    <MultiSelectDropdown options={formOptions} selected={selectedForms} onChange={setSelectedForms} placeholder="Select forms..." />

                    <button type="submit" className="bg-primary hover:bg-primary/90 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer mt-1">
                        Add Client
                    </button>
                </form>
            </Modal>

            {/* One-time credentials reveal modal */}
            <Modal open={!!credsModal} onClose={() => setCredsModal(null)} title="Client Created">
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Save this password — it won&apos;t be shown again after you close this window.
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium">Email</span>
                        <span className="text-sm font-mono text-foreground">{credsModal?.email}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium">Password</span>
                        <span className="text-sm font-mono text-foreground">{credsModal?.password}</span>
                    </div>
                    <button
                        onClick={copyCredsModalCredentials}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors cursor-pointer self-start"
                    >
                        {credsCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        {credsCopied ? "Copied!" : "Copy Credentials"}
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
                defaultSort="dateCreated"
                defaultSortDirection="desc"
            />

            {/* Floating bulk action bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-2xl px-5 py-3 flex items-center gap-4 z-50 animate-[fadeIn_150ms_ease-out]">
                    <span className="text-sm text-foreground font-medium">
                        {selectedIds.size} client{selectedIds.size > 1 ? "s" : ""} selected
                    </span>
                    <button
                        onClick={() => {
                            setShowFormPicker(true);
                            setPickerForms([]);
                            setSendMode("now");
                            setScheduledDate("");
                        }}
                        className="bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Request Form
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer">
                        Cancel
                    </button>
                </div>
            )}

            {/* Freeze Modal */}
            <Modal
                open={showFreezeModal}
                onClose={() => setShowFreezeModal(false)}
                title={`Freeze Subscription — ${freezingClient?.name ?? ""}`}
            >
                <form onSubmit={handleFreeze} className="flex flex-col gap-3">
                    {freezeError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-destructive text-xs">{freezeError}</p>
                        </div>
                    )}
                    <div>
                        <label className="text-muted-foreground text-xs font-medium">Freeze Start Date *</label>
                        <input
                            type="date"
                            value={freezeStartDate}
                            onChange={e => setFreezeStartDate(e.target.value)}
                            className={`${inputCls} mt-1`}
                        />
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs font-medium">Freeze Duration (days) *</label>
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
                        <label className="text-muted-foreground text-xs font-medium">Notes <span className="font-normal opacity-60">(optional)</span></label>
                        <textarea
                            rows={2}
                            value={freezeNotes}
                            onChange={e => setFreezeNotes(e.target.value)}
                            placeholder="Reason for freeze..."
                            className={`${inputCls} resize-none mt-1`}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={freezeSaving}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                        {freezeSaving ? "Saving…" : "Add Freeze"}
                    </button>
                </form>
            </Modal>

            {/* Bulk form picker modal */}
            {showFormPicker && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => setShowFormPicker(false)}>
                    <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 animate-[fadeIn_150ms_ease-out]" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-foreground">Request Forms</h3>
                        <p className="text-muted-foreground text-sm">
                            Choose forms to assign to {selectedIds.size} selected client{selectedIds.size > 1 ? "s" : ""}.
                        </p>

                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {availableForms.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No active forms available.</p>
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
                                                    : "bg-background text-foreground hover:bg-accent border border-transparent"
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
                                            <span className="flex-1">{form.title}</span>
                                            {form.type && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    form.type === "assessment" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                                }`}>
                                                    {form.type === "assessment" ? "Assessment" : "Check-in"}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Send mode */}
                        <div className="flex flex-col gap-3 border-t border-border pt-4">
                            <span className="text-muted-foreground text-xs font-medium">When to send</span>
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
                                    Send Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSendMode("scheduled")}
                                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                        sendMode === "scheduled"
                                            ? "bg-blue-50 text-blue-600 border border-blue-200"
                                            : "bg-background text-muted-foreground hover:text-foreground border border-transparent"
                                    }`}
                                >
                                    Schedule
                                </button>
                            </div>
                            {sendMode === "scheduled" && (
                                <input
                                    type="datetime-local"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                                />
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowFormPicker(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkAssign}
                                disabled={pickerForms.length === 0 || assigning || (sendMode === "scheduled" && !scheduledDate)}
                                className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm cursor-pointer"
                            >
                                {assigning ? "Assigning..." : sendMode === "scheduled"
                                    ? `Schedule${pickerForms.length > 0 ? ` (${pickerForms.length})` : ""}`
                                    : `Assign${pickerForms.length > 0 ? ` (${pickerForms.length})` : ""}`
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
