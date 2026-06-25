"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, ListFilter, Pencil, Plus, Power, Trash2, Package } from "lucide-react";
import Modal, { ModalFooter } from "@/app/components/Modal";
import EmptyState from "@/app/components/EmptyState";
import PackagePolicyOverride from "@/app/components/PackagePolicyOverride";
import { FieldLabel } from "@/app/components/Field";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Table } from "@heroui/react/table";
import { SearchField } from "@heroui/react/search-field";
import { Surface } from "@heroui/react/surface";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { ComboBox } from "@heroui/react/combo-box";
import { ListBox } from "@heroui/react/list-box";

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

// --- SEARCHABLE CURRENCY DROPDOWN ---
// HeroUI ComboBox (secondary variant) — matches the app's shared field design system
// (same pattern as CountryCodeSelect / the Add Client modal).
function CurrencySelect({ value, onChange, className }) {
    const t = useTranslations('packages');

    return (
        <ComboBox
            className={className ?? "w-full"}
            variant="secondary"
            aria-label={t('selectCurrency')}
            menuTrigger="focus"
            selectedKey={value ?? null}
            onSelectionChange={(key) => { if (key) onChange(key); }}
        >
            <ComboBox.InputGroup>
                <Input placeholder={t('selectCurrency')} />
                <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
                <ListBox>
                    {CURRENCIES.map(c => (
                        <ListBox.Item key={c} id={c} textValue={c}>
                            {c}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </ComboBox.Popover>
        </ComboBox>
    );
}

function emptyVariation() {
    return { name: "", description: "", duration: "", price: "", currency: "EGP" };
}

// Row action items that stay hidden until the row is hovered or an action is focused.
const HOVER_ACTIONS = "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100";

export default function PackagesPage() {
    const t = useTranslations('packages');
    const tCommon = useTranslations('common');
    const tFilter = useTranslations('filter');

    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    // Package and variation are edited in separate modals (one entity each).
    const [editingPackage, setEditingPackage] = useState(null);     // { id, name } | null
    const [editingVariation, setEditingVariation] = useState(null); // { packageId, variationId, name, duration, price, currency, description } | null
    // Which package rows are expanded to reveal their variations (react-aria tree keys).
    const [expandedPackages, setExpandedPackages] = useState(() => new Set());
    const [search, setSearch] = useState("");
    // Variation-level filters (status = active state, duration/price = ranges).
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [pendingFilterKey, setPendingFilterKey] = useState(null); // which sub-panel is open
    const [statusFilter, setStatusFilter] = useState([]); // [] = all; subset of ["active","inactive"]
    const [durationMin, setDurationMin] = useState("");
    const [durationMax, setDurationMax] = useState("");
    const [priceMin, setPriceMin] = useState("");
    const [priceMax, setPriceMax] = useState("");

    // Create-package modal (a brand-new package + its variations)
    const [packageName, setPackageName] = useState("");
    const [variations, setVariations] = useState([emptyVariation()]);
    // Add-variation modal (a single variation onto an existing package)
    const [addVariationTarget, setAddVariationTarget] = useState(null); // package | null
    const [newVariation, setNewVariation] = useState(emptyVariation());
    const [error, setError] = useState("");

    const searchRef = useRef(null);

    useEffect(() => {
        api.get("/api/packages")
            .then(res => setPackages(res.data ?? []))
            .catch(() => setPackages([]))
            .finally(() => setLoading(false));
    }, []);

    // Ctrl+K focuses the quick search (matches the shared DataTable shortcut).
    useEffect(() => {
        function onKeyDown(e) {
            if (e.ctrlKey && (e.key === "k" || e.key === "K")) {
                e.preventDefault();
                searchRef.current?.querySelector("input")?.focus();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    // Filters apply at the variation level (status = active, duration/price = ranges);
    // a package is shown when at least one of its variations passes.
    const query = search.trim().toLowerCase();
    const durationMinNum = durationMin !== "" ? Number(durationMin) : null;
    const durationMaxNum = durationMax !== "" ? Number(durationMax) : null;
    const priceMinNum = priceMin !== "" ? Number(priceMin) : null;
    const priceMaxNum = priceMax !== "" ? Number(priceMax) : null;

    function variationPassesFilters(v) {
        if (statusFilter.length > 0) {
            if (v.active && !statusFilter.includes("active")) return false;
            if (!v.active && !statusFilter.includes("inactive")) return false;
        }
        if (durationMinNum !== null && Number(v.duration) < durationMinNum) return false;
        if (durationMaxNum !== null && Number(v.duration) > durationMaxNum) return false;
        if (priceMinNum !== null && Number(v.price) < priceMinNum) return false;
        if (priceMaxNum !== null && Number(v.price) > priceMaxNum) return false;
        return true;
    }

    function clearFilters() {
        setStatusFilter([]);
        setDurationMin(""); setDurationMax("");
        setPriceMin(""); setPriceMax("");
    }

    // Render a "min – max" / "≥ min" / "≤ max" summary for a range chip.
    function rangeText(min, max) {
        if (min !== "" && max !== "") return `${min} – ${max}`;
        if (min !== "") return `≥ ${min}`;
        return `≤ ${max}`;
    }

    // Active filters as removable chips (matches the DataTable filter style).
    const filterChips = [];
    if (statusFilter.length > 0) {
        filterChips.push({
            key: "status",
            label: t('statusLabel'),
            value: statusFilter.map(s => s === "active" ? t('active') : t('inactive')).join(", "),
            clear: () => setStatusFilter([]),
        });
    }
    if (durationMin !== "" || durationMax !== "") {
        filterChips.push({ key: "duration", label: t('colDuration'), value: rangeText(durationMin, durationMax), clear: () => { setDurationMin(""); setDurationMax(""); } });
    }
    if (priceMin !== "" || priceMax !== "") {
        filterChips.push({ key: "price", label: t('colPrice'), value: rangeText(priceMin, priceMax), clear: () => { setPriceMin(""); setPriceMax(""); } });
    }

    // Tree rows: each package is a parent row whose children are its (visible)
    // variations. Search matches package or variation name; filters narrow the
    // variations shown, and packages with no surviving variation drop out.
    const treeRows = packages
        .map(p => {
            const packageNameHit = !query || p.name.toLowerCase().includes(query);
            const visibleVariations = p.variations.filter(v =>
                variationPassesFilters(v) &&
                (packageNameHit || v.name.toLowerCase().includes(query)));
            return { pkg: p, visibleVariations };
        })
        .filter(({ visibleVariations }) => visibleVariations.length > 0)
        .map(({ pkg: p, visibleVariations }) => ({
            id: `pkg-${p.id}`,
            type: "package",
            name: p.name,
            active: p.active,
            pkg: p,
            children: visibleVariations.map(v => ({
                id: `var-${p.id}-${v.id}`,
                type: "variation",
                name: v.name,
                active: v.active,
                pkg: p,
                variation: v,
                children: [],
            })),
        }));

    // Active toggle shared by package and variation action rows.
    function toggleActiveButton(isActive, onToggle) {
        const label = isActive ? tCommon('deactivate') : tCommon('activate');
        return (
            <Tooltip>
                <Button isIconOnly size="sm" variant="ghost" aria-label={label} className={isActive ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"} onClick={onToggle}>
                    <Power className="h-4 w-4" />
                </Button>
                <Tooltip.Content>{label}</Tooltip.Content>
            </Tooltip>
        );
    }

    function packageActions(pkg) {
        return (
            <div className="flex items-center gap-1 justify-end">
                {/* Visible only when the row is hovered (or an action is focused). */}
                <span className={HOVER_ACTIONS}>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={t('addVariation')} onClick={() => startAddVariation(pkg)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{t('addVariation')}</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('edit')} onClick={() => startEditPackage(pkg)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('edit')}</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('delete')} className="text-destructive hover:text-red-700" onClick={() => handleDeletePackage(pkg.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('delete')}</Tooltip.Content>
                    </Tooltip>
                </span>
                {toggleActiveButton(pkg.active, () => handleTogglePackageActive(pkg.id, pkg.active))}
            </div>
        );
    }

    function variationActions(pkg, v) {
        return (
            <div className="flex items-center gap-1 justify-end">
                {/* Visible only when the row is hovered (or an action is focused). */}
                <span className={HOVER_ACTIONS}>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('edit')} onClick={() => startEditVariation(pkg, v)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('edit')}</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('delete')} className="text-destructive hover:text-red-700" onClick={() => handleDeleteVariation(pkg.id, v.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('delete')}</Tooltip.Content>
                    </Tooltip>
                </span>
                {toggleActiveButton(v.active, () => handleToggleVariationActive(pkg.id, v.id, v.active))}
            </div>
        );
    }

    // Single render fn for both package (parent) and variation (child) rows.
    // The tree column auto-renders the expand chevron via the cell render-prop.
    function renderTreeRow(row) {
        const isPackage = row.type === "package";
        const v = row.variation;
        return (
            <Table.Row id={row.id} textValue={row.name} className="group">
                <Table.Cell textValue={row.name}>
                    {({ hasChildItems, isExpanded, isTreeColumn }) => (
                        <span className="flex items-center gap-1.5">
                            {hasChildItems && isTreeColumn ? (
                                <Button isIconOnly slot="chevron" size="sm" variant="ghost" aria-label={isExpanded ? tCommon('collapse') : tCommon('expand')}>
                                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : "rtl:rotate-180"}`} />
                                </Button>
                            ) : null}
                            <span className={isPackage ? "font-medium text-accent" : "text-foreground"}>{row.name}</span>
                            {isPackage && (
                                <span className="text-xs text-muted-foreground">· {t('variationCount', { count: row.children.length })}</span>
                            )}
                        </span>
                    )}
                </Table.Cell>
                <Table.Cell>{isPackage ? null : t('durationDays', { count: v.duration })}</Table.Cell>
                <Table.Cell>{isPackage ? null : `${Number(v.price).toLocaleString()} ${v.currency}`}</Table.Cell>
                <Table.Cell>{isPackage ? null : <span className="text-muted-foreground">{v.description || "—"}</span>}</Table.Cell>
                <Table.Cell className="text-end">{isPackage ? packageActions(row.pkg) : variationActions(row.pkg, v)}</Table.Cell>
                <Table.Collection items={row.children}>{renderTreeRow}</Table.Collection>
            </Table.Row>
        );
    }

    // ── Active toggles (from the actions column) ──────────────
    async function handleTogglePackageActive(packageId, currentActive) {
        try {
            const res = await api.put("/api/packages", { id: packageId, active: !currentActive });
            setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
        } catch (err) {
            setError(err.response?.data?.error || t('errorUpdatePackage'));
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
            setError(err.response?.data?.error || t('errorUpdateVariation'));
        }
    }

    // ── Edit package (name only; active is toggled from the table) ──
    function startEditPackage(pkg) {
        setError("");
        setEditingPackage({ id: pkg.id, name: pkg.name });
    }

    async function handleSavePackage(e) {
        e.preventDefault();
        if (!editingPackage) return;
        const pkg = packages.find(p => p.id === editingPackage.id);
        if (!pkg) return;
        if (!editingPackage.name?.trim()) { setError(t('errorPackageName')); return; }

        try {
            const res = await api.put("/api/packages", { id: pkg.id, name: editingPackage.name.trim() });
            setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
            setEditingPackage(null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.error || t('errorSave'));
        }
    }

    // ── Edit variation (its own fields; active is toggled from the table) ──
    function startEditVariation(pkg, v) {
        setError("");
        setEditingVariation({
            packageId: pkg.id,
            variationId: v.id,
            name: v.name,
            duration: v.duration,
            price: v.price,
            currency: v.currency,
            description: v.description ?? "",
        });
    }

    async function handleSaveVariation(e) {
        e.preventDefault();
        const ev = editingVariation;
        if (!ev) return;
        const pkg = packages.find(p => p.id === ev.packageId);
        if (!pkg) return;

        if (!ev.name?.trim()) { setError(t('errorVariationName')); return; }
        const duration = Number(ev.duration);
        if (!Number.isFinite(duration) || duration <= 0) { setError(t('errorVariationDurationN', { n: 1 })); return; }
        const price = Number(ev.price);
        if (!Number.isFinite(price) || price <= 0) { setError(t('errorVariationPriceN', { n: 1 })); return; }
        if (!ev.currency?.trim()) { setError(t('errorVariationCurrencyN', { n: 1 })); return; }

        const updatedVariations = pkg.variations.map(v =>
            v.id === ev.variationId
                ? { ...v, name: ev.name.trim(), description: ev.description?.trim() || "", duration, price, currency: ev.currency.trim() }
                : v
        );

        try {
            const res = await api.put("/api/packages", { id: pkg.id, variations: updatedVariations });
            setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
            setEditingVariation(null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.error || t('errorSave'));
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
            setError(err.response?.data?.error || t('errorDeleteVariation'));
        }
    }

    async function handleDeletePackage(packageId) {
        if (!confirm(t('deletePackageConfirm'))) return;
        try {
            await api.delete("/api/packages", { data: { packageId } });
            setPackages(prev => prev.filter(p => p.id !== packageId));
        } catch (err) {
            setError(err.response?.data?.error || t('errorDeletePackage'));
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

        if (!packageName.trim()) { setError(t('errorPackageName')); return; }
        for (let i = 0; i < variations.length; i++) {
            const v = variations[i];
            if (!v.name.trim()) { setError(t('errorVariationNameN', { n: i + 1 })); return; }
            const dur = Number(v.duration);
            if (!Number.isFinite(dur) || dur <= 0) { setError(t('errorVariationDurationN', { n: i + 1 })); return; }
            const pr = Number(v.price);
            if (!Number.isFinite(pr) || pr <= 0) { setError(t('errorVariationPriceN', { n: i + 1 })); return; }
            if (!v.currency.trim()) { setError(t('errorVariationCurrencyN', { n: i + 1 })); return; }
        }

        try {
            const res = await api.post("/api/packages", { name: packageName, variations });
            setPackages(prev => [...prev, res.data]);
            setPackageName("");
            setVariations([emptyVariation()]);
            setShowForm(false);
        } catch (err) {
            setError(err.response?.data?.error || t('errorCreate'));
        }
    }

    // ── Add a variation to an existing package (separate from creating a package) ──
    function startAddVariation(pkg) {
        setError("");
        setNewVariation(emptyVariation());
        setAddVariationTarget(pkg);
    }

    function updateNewVariation(field, value) {
        setNewVariation(prev => ({ ...prev, [field]: value }));
    }

    async function handleCreateVariation(e) {
        e.preventDefault();
        const pkg = addVariationTarget;
        if (!pkg) return;
        const v = newVariation;

        if (!v.name.trim()) { setError(t('errorVariationName')); return; }
        const duration = Number(v.duration);
        if (!Number.isFinite(duration) || duration <= 0) { setError(t('errorVariationDurationN', { n: 1 })); return; }
        const price = Number(v.price);
        if (!Number.isFinite(price) || price <= 0) { setError(t('errorVariationPriceN', { n: 1 })); return; }
        if (!v.currency.trim()) { setError(t('errorVariationCurrencyN', { n: 1 })); return; }

        const maxVarId = pkg.variations.reduce((max, x) => Math.max(max, x.id), 0);
        const newVar = {
            id: maxVarId + 1,
            name: v.name.trim(),
            description: v.description?.trim() || "",
            duration,
            price,
            currency: v.currency.trim(),
            active: true,
        };

        try {
            const res = await api.put("/api/packages", { id: pkg.id, variations: [...pkg.variations, newVar] });
            setPackages(prev => prev.map(p => p.id === res.data.id ? res.data : p));
            setAddVariationTarget(null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.error || t('errorCreate'));
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
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
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {/* Toggle/delete errors (edit + create errors render inside their modals) */}
            {!showForm && !addVariationTarget && !editingPackage && !editingVariation && error && <p className="text-destructive text-sm">{error}</p>}

            {/* New Package Modal — creates a brand-new package + its variations */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setError(""); }} title={t('newPackageTitle')} wide>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-1 py-1">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('packageNameLabel')}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t('packageNameLabel')} value={packageName} onChange={setPackageName}>
                            <Input type="text" placeholder={t('packageNameLabel')} />
                        </TextField>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <FieldLabel>{t('variationsLabel')}</FieldLabel>
                            <Button type="button" variant="ghost" size="sm" onClick={addVariation} className="text-xs text-primary px-3">
                                {t('addVariation')}
                            </Button>
                        </div>

                        {/* Scrollable so many variations stay tidy in a small modal */}
                        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
                            {variations.map((v, i) => (
                                <Surface key={i} variant="transparent" className="p-3 rounded-lg border border-border flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground font-medium">{t('variationNumber', { n: i + 1 })}</span>
                                        {variations.length > 1 && (
                                            <Tooltip>
                                                <Button isIconOnly size="sm" variant="ghost" aria-label={t('remove')} className="text-destructive hover:text-red-700" onClick={() => removeVariation(i)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Tooltip.Content>{t('remove')}</Tooltip.Content>
                                            </Tooltip>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel required>{t('variationNamePlaceholder')}</FieldLabel>
                                            <TextField variant="secondary" fullWidth aria-label={t('variationNamePlaceholder')} value={v.name} onChange={(val) => updateVariation(i, "name", val)}>
                                                <Input type="text" placeholder={t('variationNamePlaceholder')} />
                                            </TextField>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel required>{t('colDuration')}</FieldLabel>
                                            <TextField variant="secondary" fullWidth aria-label={t('durationPlaceholder')} value={v.duration} onChange={(val) => updateVariation(i, "duration", val)}>
                                                <Input type="number" min="1" inputMode="numeric" placeholder={t('durationPlaceholder')} />
                                            </TextField>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel required>{t('colPrice')}</FieldLabel>
                                            <TextField variant="secondary" fullWidth aria-label={t('pricePlaceholder')} value={v.price} onChange={(val) => updateVariation(i, "price", val)}>
                                                <Input type="number" min="0" inputMode="decimal" placeholder={t('pricePlaceholder')} />
                                            </TextField>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel required>{t('currencyLabel')}</FieldLabel>
                                            <CurrencySelect
                                                value={v.currency}
                                                onChange={(c) => updateVariation(i, "currency", c)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>{t('colDescription')}</FieldLabel>
                                        <TextField variant="secondary" fullWidth aria-label={t('descriptionPlaceholder')} value={v.description} onChange={(val) => updateVariation(i, "description", val)}>
                                            <Input type="text" placeholder={t('descriptionPlaceholder')} />
                                        </TextField>
                                    </div>
                                </Surface>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{error}</p>
                        </div>
                    )}

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setError(""); }}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary">
                            {t('createPackage')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* New Variation Modal — adds a single variation to an existing package */}
            <Modal open={!!addVariationTarget} onClose={() => { setAddVariationTarget(null); setError(""); }} title={addVariationTarget ? `${t('addVariation')} — ${addVariationTarget.name}` : t('addVariation')} wide>
                <form onSubmit={handleCreateVariation} className="flex flex-col gap-5 px-4 py-1">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('variationNamePlaceholder')}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t('variationNamePlaceholder')} value={newVariation.name} onChange={(val) => updateNewVariation("name", val)}>
                                <Input type="text" placeholder={t('variationNamePlaceholder')} />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('colDuration')}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t('durationPlaceholder')} value={String(newVariation.duration)} onChange={(val) => updateNewVariation("duration", val)}>
                                <Input type="number" min="1" inputMode="numeric" placeholder={t('durationPlaceholder')} />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('colPrice')}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t('pricePlaceholder')} value={String(newVariation.price)} onChange={(val) => updateNewVariation("price", val)}>
                                <Input type="number" min="0" inputMode="decimal" placeholder={t('pricePlaceholder')} />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('currencyLabel')}</FieldLabel>
                            <CurrencySelect
                                value={newVariation.currency}
                                onChange={(c) => updateNewVariation("currency", c)}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('colDescription')}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t('descriptionPlaceholder')} value={newVariation.description} onChange={(val) => updateNewVariation("description", val)}>
                            <Input type="text" placeholder={t('descriptionPlaceholder')} />
                        </TextField>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{error}</p>
                        </div>
                    )}

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setAddVariationTarget(null); setError(""); }}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary">
                            {t('addVariation')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Edit Package Modal — package name (active is toggled from the table) */}
            <Modal open={!!editingPackage} onClose={() => { setEditingPackage(null); setError(""); }} title={t('editPackageTitle')}>
                <form onSubmit={handleSavePackage} className="flex flex-col gap-5 px-1 py-1">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('packageNameLabel')}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t('packageNameLabel')} value={editingPackage?.name ?? ""} onChange={(val) => setEditingPackage(p => ({ ...p, name: val }))}>
                            <Input type="text" placeholder={t('packageNameLabel')} />
                        </TextField>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{error}</p>
                        </div>
                    )}

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setEditingPackage(null); setError(""); }}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary">
                            {t('save')}
                        </Button>
                    </ModalFooter>
                </form>

                {editingPackage && <PackagePolicyOverride packageId={editingPackage.id} />}
            </Modal>

            {/* Edit Variation Modal — variation fields (active is toggled from the table) */}
            <Modal open={!!editingVariation} onClose={() => { setEditingVariation(null); setError(""); }} title={t('editVariationTitle')} wide>
                <form onSubmit={handleSaveVariation} className="flex flex-col gap-5 px-1 py-1">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('variationNamePlaceholder')}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t('variationNamePlaceholder')} value={editingVariation?.name ?? ""} onChange={(val) => setEditingVariation(ev => ({ ...ev, name: val }))}>
                                <Input type="text" placeholder={t('variationNamePlaceholder')} />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('colDuration')}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t('durationPlaceholder')} value={String(editingVariation?.duration ?? "")} onChange={(val) => setEditingVariation(ev => ({ ...ev, duration: val }))}>
                                <Input type="number" min="1" inputMode="numeric" placeholder={t('durationPlaceholder')} />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('colPrice')}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t('pricePlaceholder')} value={String(editingVariation?.price ?? "")} onChange={(val) => setEditingVariation(ev => ({ ...ev, price: val }))}>
                                <Input type="number" min="0" inputMode="decimal" placeholder={t('pricePlaceholder')} />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('currencyLabel')}</FieldLabel>
                            <CurrencySelect
                                value={editingVariation?.currency}
                                onChange={(c) => setEditingVariation(ev => ({ ...ev, currency: c }))}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('colDescription')}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t('descriptionPlaceholder')} value={editingVariation?.description ?? ""} onChange={(val) => setEditingVariation(ev => ({ ...ev, description: val }))}>
                            <Input type="text" placeholder={t('descriptionPlaceholder')} />
                        </TextField>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{error}</p>
                        </div>
                    )}

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setEditingVariation(null); setError(""); }}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary">
                            {t('save')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Toolbar: quick search + New Package */}
            <div className="flex items-center gap-2">
                <div ref={searchRef} className="max-w-xs w-full">
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        onClear={() => setSearch("")}
                        aria-label={t('searchPlaceholder')}
                        fullWidth
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input className="py-2" placeholder={t('searchPlaceholder')} />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                </div>

                {/* Filter — same pattern as the shared DataTable: field list → side sub-panel */}
                <div className="relative">
                    {filtersOpen && <div className="fixed inset-0 z-10" onClick={() => { setFiltersOpen(false); setPendingFilterKey(null); }} />}
                    <Button size="sm" variant="secondary" onClick={() => setFiltersOpen(o => !o)}>
                        <ListFilter size={14} />
                        {tFilter('filterButton')}
                    </Button>
                    {filtersOpen && (
                        <div className="absolute z-20 top-full mt-1 bg-card border border-border rounded-xl shadow-md p-2 flex flex-col gap-1 min-w-48">
                            {/* Status */}
                            <div className="relative">
                                <button
                                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between ${pendingFilterKey === "status" ? "bg-primary/10 text-primary" : "hover:bg-default"}`}
                                    onClick={() => setPendingFilterKey(pendingFilterKey === "status" ? null : "status")}
                                >
                                    {t('statusLabel')}
                                    <ChevronRight size={14} className="text-muted-foreground shrink-0 rtl:rotate-180" />
                                </button>
                                {pendingFilterKey === "status" && (
                                    <div className="absolute z-30 ltr:left-full rtl:right-full top-0 ltr:ml-1 rtl:mr-1 bg-card border border-border rounded-xl shadow-md p-2 flex flex-col gap-0.5 min-w-44">
                                        {[["active", t('active')], ["inactive", t('inactive')]].map(([value, label]) => (
                                            <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-default cursor-pointer text-sm select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={statusFilter.includes(value)}
                                                    onChange={(e) => setStatusFilter(prev => e.target.checked ? [...prev, value] : prev.filter(s => s !== value))}
                                                    className="rounded"
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Duration */}
                            <div className="relative">
                                <button
                                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between ${pendingFilterKey === "duration" ? "bg-primary/10 text-primary" : "hover:bg-default"}`}
                                    onClick={() => setPendingFilterKey(pendingFilterKey === "duration" ? null : "duration")}
                                >
                                    {t('colDuration')}
                                    <ChevronRight size={14} className="text-muted-foreground shrink-0 rtl:rotate-180" />
                                </button>
                                {pendingFilterKey === "duration" && (
                                    <div className="absolute z-30 ltr:left-full rtl:right-full top-0 ltr:ml-1 rtl:mr-1 bg-card border border-border rounded-xl shadow-md p-3 flex items-center gap-2 min-w-56">
                                        <input type="number" min="0" inputMode="numeric" placeholder={t('minLabel')} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className="w-full px-2 py-1 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                        <span className="text-muted-foreground">–</span>
                                        <input type="number" min="0" inputMode="numeric" placeholder={t('maxLabel')} value={durationMax} onChange={(e) => setDurationMax(e.target.value)} className="w-full px-2 py-1 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                    </div>
                                )}
                            </div>
                            {/* Price */}
                            <div className="relative">
                                <button
                                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between ${pendingFilterKey === "price" ? "bg-primary/10 text-primary" : "hover:bg-default"}`}
                                    onClick={() => setPendingFilterKey(pendingFilterKey === "price" ? null : "price")}
                                >
                                    {t('colPrice')}
                                    <ChevronRight size={14} className="text-muted-foreground shrink-0 rtl:rotate-180" />
                                </button>
                                {pendingFilterKey === "price" && (
                                    <div className="absolute z-30 ltr:left-full rtl:right-full top-0 ltr:ml-1 rtl:mr-1 bg-card border border-border rounded-xl shadow-md p-3 flex items-center gap-2 min-w-56">
                                        <input type="number" min="0" inputMode="decimal" placeholder={t('minLabel')} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="w-full px-2 py-1 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                        <span className="text-muted-foreground">–</span>
                                        <input type="number" min="0" inputMode="decimal" placeholder={t('maxLabel')} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="w-full px-2 py-1 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="ms-auto">
                    <Button variant="primary" onClick={() => { setShowForm(true); setError(""); setPackageName(""); setVariations([emptyVariation()]); }}>
                        {t('newPackage')}
                    </Button>
                </div>
            </div>

            {/* Active filter chips (matches DataTable) */}
            {filterChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {filterChips.map(chip => (
                        <div key={chip.key} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm border border-primary/20">
                            <span className="font-medium">{chip.label}:</span>
                            <span>{chip.value}</span>
                            <button className="ml-0.5 hover:text-destructive transition-colors leading-none" onClick={chip.clear}>✕</button>
                        </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={clearFilters}>
                        {tFilter('clearAll')}
                    </Button>
                </div>
            )}

            {/* Expandable table — packages as parent rows, variations as children */}
            <Table>
                <Table.ScrollContainer>
                    <Table.Content
                        aria-label={t('title')}
                        treeColumn="name"
                        expandedKeys={expandedPackages}
                        onExpandedChange={setExpandedPackages}
                    >
                        <Table.Header>
                            <Table.Column isRowHeader id="name">{t('colPackage')}</Table.Column>
                            <Table.Column id="duration">{t('colDuration')}</Table.Column>
                            <Table.Column id="price">{t('colPrice')}</Table.Column>
                            <Table.Column id="description">{t('colDescription')}</Table.Column>
                            <Table.Column id="actions"><span className="sr-only">{tCommon('edit')}</span></Table.Column>
                        </Table.Header>
                        <Table.Body items={treeRows}>{renderTreeRow}</Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>

            {treeRows.length === 0 && (
                packages.length === 0 ? (
                    <EmptyState
                        variant="firstTime"
                        icon={Package}
                        title={t('emptyTitle')}
                        description={t('emptyHint')}
                        action={{
                            label: t('newPackage'),
                            onPress: () => { setShowForm(true); setError(""); setPackageName(""); setVariations([emptyVariation()]); },
                        }}
                    />
                ) : (
                    <EmptyState
                        variant={search ? "search" : "filter"}
                        title={search ? tFilter('searchEmptyTitle') : tFilter('filterEmptyTitle')}
                        description={search ? tFilter('searchEmptyHint') : tFilter('filterEmptyHint')}
                        action={{
                            label: search && filterChips.length > 0
                                ? tFilter('clearAll')
                                : search ? tFilter('clearSearch') : tFilter('clearFilters'),
                            onPress: () => { setSearch(""); clearFilters(); },
                        }}
                    />
                )
            )}
        </div>
    );
}
