"use client";

import { useState, useRef, useEffect } from "react";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

// --- CURRENCY LIST ---
const CURRENCIES = [
    "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN",
    "BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL",
    "BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHF","CLP","CNY",
    "COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP",
    "ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD",
    "GNF","GTQ","GYD","HKD","HNL","HRK","HTG","HUF","IDR","ILS",
    "INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR",
    "KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD",
    "LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU",
    "MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK",
    "NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG",
    "QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK",
    "SGD","SHP","SLE","SOS","SRD","SSP","STN","SYP","SZL","THB",
    "TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX",
    "USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XOF",
    "XPF","YER","ZAR","ZMW","ZWL",
];

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";
const editInputCls = "w-full px-2 py-1 rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

// --- SEARCHABLE CURRENCY DROPDOWN ---
function CurrencySelect({ value, onChange }) {
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

    const filtered = CURRENCIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
                {value || "Select currency"}
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-20 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-[fadeIn_150ms_ease-out]">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-background border-b border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none"
                        autoFocus
                    />
                    <div className="max-h-40 overflow-y-auto">
                        {filtered.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                    c === value
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground hover:bg-default"
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                        {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No match</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- PACKAGE NAME COMBO (select existing or type new) ---
function PackageNameCombo({ value, onChange, packages }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const ref = useRef(null);

    useEffect(() => { setSearch(value); }, [value]);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    function handleInputChange(e) {
        const val = e.target.value;
        setSearch(val);
        setOpen(true);
        const match = packages.find(p => p.name.toLowerCase() === val.toLowerCase());
        onChange(val, match ? match.id : null);
    }

    function handleSelect(pkg) {
        setSearch(pkg.name);
        onChange(pkg.name, pkg.id);
        setOpen(false);
    }

    function handleCreateNew() {
        onChange(search, null);
        setOpen(false);
    }

    const exactMatch = packages.some(p => p.name.toLowerCase() === search.trim().toLowerCase());

    return (
        <div className="relative" ref={ref}>
            <input
                type="text"
                placeholder="Type to search or create new..."
                value={search}
                onChange={handleInputChange}
                onFocus={() => setOpen(true)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-[fadeIn_150ms_ease-out]">
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map(pkg => (
                            <button
                                key={pkg.id}
                                type="button"
                                onClick={() => handleSelect(pkg)}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                                    pkg.id === (packages.find(p => p.name === value)?.id)
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground hover:bg-default"
                                }`}
                            >
                                <span>{pkg.name}</span>
                                <span className="text-xs text-muted-foreground">{pkg.variations.length} variation{pkg.variations.length !== 1 ? "s" : ""}</span>
                            </button>
                        ))}
                        {search.trim() && !exactMatch && (
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-default transition-colors border-t border-border"
                            >
                                + Create &quot;{search.trim()}&quot; as new package
                            </button>
                        )}
                        {filtered.length === 0 && !search.trim() && (
                            <p className="px-4 py-2 text-xs text-muted-foreground">No packages yet</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- FLATTEN packages into rows for DataTable ---
function flattenPackages(packages) {
    const rows = [];
    for (const pkg of packages) {
        for (const v of pkg.variations) {
            rows.push({
                _rowId: `${pkg.id}-${v.id}`,
                _packageId: pkg.id,
                _variationId: v.id,
                packageName: pkg.name,
                packageActive: pkg.active,
                variationName: v.name,
                variationActive: v.active,
                description: v.description,
                duration: v.duration,
                price: v.price,
                currency: v.currency,
            });
        }
    }
    return rows;
}

function emptyVariation() {
    return { name: "", description: "", duration: "", price: "", currency: "EGP" };
}

const activeBadge   = "bg-green-500/15 text-green-600 hover:bg-green-500/25";
const inactiveBadge = "bg-secondary text-muted-foreground hover:bg-secondary/80";

export default function PackagesPage() {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [editData, setEditData] = useState({});

    const [packageName, setPackageName] = useState("");
    const [selectedPackageId, setSelectedPackageId] = useState(null);
    const [variations, setVariations] = useState([emptyVariation()]);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/api/packages")
            .then(res => setPackages(res.data ?? []))
            .catch(() => setPackages([]))
            .finally(() => setLoading(false));
    }, []);

    const rows = flattenPackages(packages);
    const packageNames = [...new Set(packages.map(p => p.name))];

    const columns = [
        {
            key: "packageName",
            label: "Package",
            filterType: "multi",
            options: packageNames,
            sortable: true,
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <input
                            type="text"
                            value={editData.packageName}
                            onChange={(e) => setEditData({ ...editData, packageName: e.target.value })}
                            className={editInputCls}
                        />
                    );
                }
                return <span className="font-medium text-foreground">{row.packageName}</span>;
            },
        },
        {
            key: "packageActive",
            label: "Pkg Active",
            filterType: "multi",
            options: ["Active", "Inactive"],
            render: (row) => (
                <button
                    onClick={() => handleTogglePackageActive(row._packageId, row.packageActive === "Active")}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        row.packageActive === "Active" ? activeBadge : inactiveBadge
                    }`}
                >
                    {row.packageActive}
                </button>
            ),
        },
        {
            key: "variationName",
            label: "Variation",
            filterType: "text",
            sortable: true,
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <input
                            type="text"
                            value={editData.variationName}
                            onChange={(e) => setEditData({ ...editData, variationName: e.target.value })}
                            className={editInputCls}
                        />
                    );
                }
                return row.variationName;
            },
        },
        {
            key: "variationActive",
            label: "Var Active",
            filterType: "multi",
            options: ["Active", "Inactive"],
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <button
                            type="button"
                            onClick={() => setEditData({ ...editData, variationActive: !editData.variationActive })}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                editData.variationActive ? activeBadge : inactiveBadge
                            }`}
                        >
                            {editData.variationActive ? "Active" : "Inactive"}
                        </button>
                    );
                }
                return (
                    <button
                        onClick={() => handleToggleVariationActive(row._packageId, row._variationId, row._variationActiveRaw)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            row.variationActive === "Active" ? activeBadge : inactiveBadge
                        }`}
                    >
                        {row.variationActive}
                    </button>
                );
            },
        },
        {
            key: "description",
            label: "Description",
            filterType: "text",
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <input
                            type="text"
                            value={editData.description}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            className={editInputCls}
                        />
                    );
                }
                return <span className="text-muted-foreground">{row.description || "—"}</span>;
            },
        },
        {
            key: "duration",
            label: "Duration (days)",
            filterType: "text",
            sortable: true,
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <input
                            type="number"
                            min="1"
                            value={editData.duration}
                            onChange={(e) => setEditData({ ...editData, duration: e.target.value })}
                            className={`w-20 ${editInputCls}`}
                        />
                    );
                }
                return `${row.duration} days`;
            },
        },
        {
            key: "price",
            label: "Price",
            filterType: "text",
            sortable: true,
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <div className="flex gap-1 items-center">
                            <input
                                type="number"
                                min="0"
                                value={editData.price}
                                onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                                className={`w-20 ${editInputCls}`}
                            />
                            <CurrencySelect
                                value={editData.currency}
                                onChange={(c) => setEditData({ ...editData, currency: c })}
                            />
                        </div>
                    );
                }
                return `${Number(row.price).toLocaleString()} ${row.currency}`;
            },
        },
        {
            key: "_actions",
            label: "",
            render: (row) => {
                if (editingRow === row._rowId) {
                    return (
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => handleSaveEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer">Save</button>
                            <button onClick={() => { setEditingRow(null); setError(""); }} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
                        </div>
                    );
                }
                return (
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => startEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer">Edit</button>
                        <button onClick={() => handleDeleteVariation(row._packageId, row._variationId)} className="text-xs text-destructive hover:text-red-700 cursor-pointer">Delete</button>
                    </div>
                );
            },
        },
    ];

    const displayRows = rows.map(r => ({
        ...r,
        _variationActiveRaw: r.variationActive,
        packageActive: r.packageActive ? "Active" : "Inactive",
        variationActive: r.variationActive ? "Active" : "Inactive",
    }));

    async function handleTogglePackageActive(packageId, currentActive) {
        try {
            await api.put("/api/packages", { id: packageId, active: !currentActive });
            setPackages(prev => prev.map(p =>
                p.id === packageId ? { ...p, active: !currentActive } : p
            ));
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update package");
        }
    }

    async function handleToggleVariationActive(packageId, variationId, currentActive) {
        const pkg = packages.find(p => p.id === packageId);
        if (!pkg) return;
        const updatedVariations = pkg.variations.map(v =>
            v.id === variationId ? { ...v, active: !currentActive } : v
        );
        try {
            const res = await api.put("/api/packages", { id: packageId, variations: updatedVariations });
            setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update variation");
        }
    }

    function startEdit(row) {
        setEditingRow(row._rowId);
        setError("");
        setEditData({
            packageName: row.packageName,
            variationName: row.variationName,
            variationActive: row._variationActiveRaw,
            description: row.description ?? "",
            duration: row.duration,
            price: row.price,
            currency: row.currency,
        });
    }

    async function handleSaveEdit(row) {
        const pkg = packages.find(p => p.id === row._packageId);
        if (!pkg) return;

        if (!editData.packageName?.trim()) { setError("Package name is required"); return; }
        if (!editData.variationName?.trim()) { setError("Variation name is required"); return; }
        const duration = Number(editData.duration);
        if (!Number.isFinite(duration) || duration <= 0) { setError("Duration must be a positive number (days)"); return; }
        const price = Number(editData.price);
        if (!Number.isFinite(price) || price <= 0) { setError("Price must be a positive number"); return; }
        if (!editData.currency?.trim()) { setError("Currency is required"); return; }

        const updatedVariations = pkg.variations.map(v =>
            v.id === row._variationId
                ? { ...v, name: editData.variationName.trim(), description: editData.description?.trim() || "", duration, price, currency: editData.currency.trim(), active: editData.variationActive }
                : v
        );

        try {
            const res = await api.put("/api/packages", {
                id: pkg.id,
                name: editData.packageName.trim(),
                variations: updatedVariations,
            });
            setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
            setEditingRow(null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save changes");
        }
    }

    async function handleDeleteVariation(packageId, variationId) {
        try {
            const res = await api.delete("/api/packages", { data: { packageId, variationId } });
            if (res.data.deleted === "package") {
                setPackages(prev => prev.filter(p => p.id !== packageId));
            } else {
                setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
            }
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete variation");
        }
    }

    function updateVariation(index, field, value) {
        setVariations(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
    }

    function addVariation() {
        setVariations(prev => [...prev, emptyVariation()]);
    }

    function removeVariation(index) {
        if (variations.length <= 1) return;
        setVariations(prev => prev.filter((_, i) => i !== index));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!packageName.trim()) { setError("Package name is required."); return; }
        for (let i = 0; i < variations.length; i++) {
            const v = variations[i];
            if (!v.name.trim()) { setError(`Variation ${i + 1}: name is required.`); return; }
            const dur = Number(v.duration);
            if (!Number.isFinite(dur) || dur <= 0) { setError(`Variation ${i + 1}: duration must be a positive number (days).`); return; }
            const pr = Number(v.price);
            if (!Number.isFinite(pr) || pr <= 0) { setError(`Variation ${i + 1}: price must be a positive number.`); return; }
            if (!v.currency.trim()) { setError(`Variation ${i + 1}: currency is required.`); return; }
        }

        try {
            if (selectedPackageId) {
                const pkg = packages.find(p => p.id === selectedPackageId);
                if (!pkg) { setError("Selected package not found."); return; }
                const maxVarId = pkg.variations.reduce((max, v) => Math.max(max, v.id), 0);
                const newVars = variations.map((v, i) => ({
                    id: maxVarId + i + 1,
                    name: v.name.trim(),
                    description: v.description?.trim() || "",
                    duration: Number(v.duration),
                    price: Number(v.price),
                    currency: v.currency.trim(),
                    active: true,
                }));
                const res = await api.put("/api/packages", {
                    id: pkg.id,
                    variations: [...pkg.variations, ...newVars],
                });
                setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
            } else {
                const res = await api.post("/api/packages", { name: packageName, variations });
                setPackages(prev => [...prev, res.data]);
            }
            setPackageName("");
            setSelectedPackageId(null);
            setVariations([emptyVariation()]);
            setShowForm(false);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save package.");
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-foreground">Packages</h1>
                </div>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Packages</h1>
                <p className="text-sm text-muted-foreground mt-1">Create and manage pricing packages for your coaching services.</p>
            </div>

            {/* Error from edit/delete */}
            {!showForm && error && <p className="text-destructive text-sm">{error}</p>}

            {/* Creation Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setError(""); }} title="New Package" wide>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Package Name</label>
                        <PackageNameCombo
                            value={packageName}
                            onChange={(name, pkgId) => { setPackageName(name); setSelectedPackageId(pkgId); }}
                            packages={packages}
                        />
                        {selectedPackageId && (
                            <p className="text-xs text-primary mt-1">Adding variations to existing package</p>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-muted-foreground">Variations (at least 1)</label>
                            <Button type="button" variant="ghost" size="sm" onClick={addVariation} className="text-xs text-primary px-0">
                                + Add Variation
                            </Button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {variations.map((v, i) => (
                                <div key={i} className="p-3 bg-background rounded-lg border border-border flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground font-medium">Variation {i + 1}</span>
                                        {variations.length > 1 && (
                                            <button type="button" onClick={() => removeVariation(i)} className="text-xs text-destructive hover:text-red-700 transition-colors cursor-pointer">
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Variation name"
                                            value={v.name}
                                            onChange={(e) => updateVariation(i, "name", e.target.value)}
                                            className={inputCls}
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Duration (days)"
                                            value={v.duration}
                                            onChange={(e) => updateVariation(i, "duration", e.target.value)}
                                            className={inputCls}
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Price"
                                            value={v.price}
                                            onChange={(e) => updateVariation(i, "price", e.target.value)}
                                            className={inputCls}
                                        />
                                        <CurrencySelect
                                            value={v.currency}
                                            onChange={(c) => updateVariation(i, "currency", c)}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Description (optional)"
                                        value={v.description}
                                        onChange={(e) => updateVariation(i, "description", e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-destructive text-sm">{error}</p>}

                    <Button type="submit" variant="primary" fullWidth>
                        {selectedPackageId ? "Add Variations" : "Create Package"}
                    </Button>
                </form>
            </Modal>

            {/* Table */}
            <DataTable
                columns={columns}
                data={displayRows}
                rowKey="_rowId"
                quickSearch={{ fields: ["packageName", "variationName"], placeholder: "Search packages..." }}
                toolbarEnd={<Button variant="primary" onClick={() => { setShowForm(true); setError(""); setPackageName(""); setSelectedPackageId(null); setVariations([emptyVariation()]); }}>+ New Package</Button>}
            />
        </div>
    );
}
