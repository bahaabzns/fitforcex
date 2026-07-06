"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import DatePickerField, { strToDate } from "@/app/components/DatePickerField";
import ProofDropZone from "@/app/components/ProofDropZone";
import { Button } from "@heroui/react/button";
import { Label } from "@heroui/react/label";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Switch } from "@heroui/react/switch";
import { TextArea } from "@heroui/react/textarea";
import { SearchField } from "@heroui/react/search-field";
import { Link as UILink } from "@heroui/react/link";

function todayStr() {
    return new Date().toISOString().split("T")[0];
}

// Flatten raw /api/packages into selectable "Package — Variation" options.
function flattenPackageOptions(packages) {
    return packages.flatMap(p =>
        p.variations.map(v => ({
            key: `${p.name} — ${v.name}`,
            label: `${p.name} — ${v.name}`,
            variationId: v.id,
            duration: v.duration,
            price: Number(v.price),
            currency: v.currency,
        }))
    );
}

/**
 * Inline searchable client picker — used only when the modal is opened without a
 * fixed target client (e.g. the finance transactions page). Matches name / code / phone.
 */
function ClientPicker({ clients, selected, onSelect, placeholder, ariaLabel }) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = !selected && query.trim()
        ? clients.filter(c => {
            const q = query.toLowerCase();
            if ((c.name || "").toLowerCase().includes(q)) return true;
            if (String(c.code ?? "").includes(q)) return true;
            if ((c.phones || []).some(p => p.number.replace(/\s/g, "").includes(q.replace(/\s/g, "")))) return true;
            return false;
        }).slice(0, 8)
        : [];

    return (
        <div ref={ref} className="relative">
            <SearchField
                aria-label={ariaLabel}
                variant="secondary"
                fullWidth
                value={selected ? selected.name : query}
                onChange={(val) => {
                    if (selected) onSelect(null);
                    setQuery(val);
                    setOpen(true);
                }}
                onClear={() => { onSelect(null); setQuery(""); setOpen(true); }}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                        placeholder={placeholder}
                        autoComplete="off"
                        onFocus={() => { if (!selected) setOpen(true); }}
                        onClick={() => { if (selected) { onSelect(null); setQuery(""); setOpen(true); } }}
                    />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>
            {open && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-default flex items-center gap-2 transition-colors"
                        >
                            <span className="text-foreground text-sm font-medium flex-1">{c.name}</span>
                            <span className="text-muted-foreground text-xs">#{c.code}</span>
                            {c.phones?.[0] && (
                                <span className="text-muted-foreground text-xs">
                                    {c.phones[0].countryCode} {c.phones[0].number}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * The form body. Rendered only while the modal is open and re-mounted on each open,
 * so its state initialises cleanly from props — no reset effect needed.
 */
function TransactionForm({
    onClose, mode, transaction, isBulk, clientPicker, pickerClients, clients,
    packages, paymentMethods, getClientHasSubscription, onSuccess,
}) {
    const { workspaceSlug } = useParams();
    const t = useTranslations("transactionModal");
    const tCommon = useTranslations("common");
    const locale = useLocale();

    const isEdit = mode === "edit";
    const packageOptions = flattenPackageOptions(packages);
    const paymentMethodOptions = paymentMethods.filter(m => m.active).map(m => m.name);

    const [selectedClient, setSelectedClient] = useState(
        () => isEdit && transaction?.clientId ? { id: transaction.clientId, name: transaction.clientName } : null
    );
    const [pkgKey, setPkgKey] = useState(() => (isEdit ? transaction?.packageVariation || "" : ""));
    const [pkg, setPkg]       = useState(() => (isEdit ? packageOptions.find(p => p.key === transaction?.packageVariation) || null : null));
    const [method, setMethod] = useState(() => (isEdit ? transaction?.paymentMethod || "" : ""));
    const [date, setDate]     = useState(() => (isEdit && transaction?.date ? transaction.date.split("T")[0] : todayStr()));
    const [subStartMode, setSubStartMode] = useState(() => (isEdit && transaction?.subscriptionStartDate ? "custom" : "auto"));
    const [subStartDate, setSubStartDate] = useState(() => (isEdit && transaction?.subscriptionStartDate ? transaction.subscriptionStartDate.split("T")[0] : ""));
    const [notes, setNotes]   = useState(() => (isEdit ? transaction?.notes || "" : ""));
    const [proofFile, setProofFile] = useState(null);
    const [proofUrl, setProofUrl]   = useState(() => (isEdit ? transaction?.proofImage || null : null));
    const [error, setError]   = useState("");
    const [saving, setSaving] = useState(false);

    // Clients this transaction targets right now (drives the start label).
    const targetClients = clientPicker ? (selectedClient ? [selectedClient] : []) : clients;

    // "firstPlan" | "queue" | "generic" — which automatic-start wording to show.
    function autoStartKind() {
        if (!getClientHasSubscription || targetClients.length === 0) return "generic";
        const states = targetClients.map(c => !!getClientHasSubscription(c.id));
        if (states.every(s => !s)) return "firstPlan";
        if (states.every(Boolean)) return "queue";
        return "generic"; // mixed bulk selection
    }
    const startKind = autoStartKind();
    const autoToggleLabel = startKind === "firstPlan" ? t("subStartFirstPlanToggle")
        : startKind === "queue" ? t("subStartQueueToggle")
        : t("subStartAutoToggle");
    const autoHint = startKind === "firstPlan" ? t("subStartHintFirstPlan")
        : startKind === "queue" ? t("subStartHintQueue")
        : t("subStartHintAuto");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (clientPicker && !selectedClient) { setError(t("errorClientRequired")); return; }
        if (!pkgKey || !pkg) { setError(t("errorPackageRequired")); return; }
        if (!method) { setError(t("errorMethodRequired")); return; }
        if (!date) { setError(t("errorDateRequired")); return; }
        if (subStartMode === "custom" && !subStartDate) { setError(t("errorSubStartRequired")); return; }

        setSaving(true);
        try {
            // Upload the proof once and share the path across every target.
            let proofImage = isEdit ? proofUrl : null;
            if (proofFile) {
                const fd = new FormData();
                fd.append("proof", proofFile);
                const up = await api.post("/api/transactions/upload-proof", fd);
                proofImage = up.data.path;
            }

            const shared = {
                packageVariation: pkgKey,
                packageVariationId: pkg?.variationId ?? null,
                amount: pkg.price,
                currency: pkg.currency,
                duration: pkg.duration,
                paymentMethod: method,
                date,
                subscriptionStartDate: subStartMode === "custom" ? subStartDate : null,
                notes: notes || null,
                proofImage,
            };

            if (isEdit) {
                const client = clientPicker ? selectedClient : { id: transaction.clientId, name: transaction.clientName };
                const res = await api.put(`/api/transactions/${transaction.id}`, {
                    ...shared,
                    clientId: client?.id ?? null,
                    clientName: client?.name ?? transaction.clientName,
                    type: transaction.type,
                    status: transaction.status,
                });
                await onSuccess?.(res.data);
            } else {
                const submitClients = clientPicker ? [selectedClient] : clients;
                const created = [];
                for (const client of submitClients) {
                    const res = await api.post("/api/transactions", {
                        ...shared,
                        clientId: client.id,
                        clientName: client.name,
                        type: "subscription",
                        status: "completed",
                    });
                    created.push(res.data);
                }
                await onSuccess?.(created);
            }
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || t("errorSaveFailed"));
        } finally {
            setSaving(false);
        }
    }

    const submitLabel = saving ? t("saving")
        : isEdit ? t("saveChanges")
        : isBulk ? t("recordBulk", { count: clients.length })
        : t("addTransaction");

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-1 py-1">
            {isBulk && (
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    {t("bulkHint", { count: clients.length })}
                </p>
            )}

            {/* Client (picker only) */}
            {clientPicker && (
                <div className="flex flex-col gap-1.5">
                    <FieldLabel required>{t("clientLabel")}</FieldLabel>
                    <ClientPicker
                        clients={pickerClients}
                        selected={selectedClient}
                        onSelect={setSelectedClient}
                        placeholder={t("clientSearchPlaceholder")}
                        ariaLabel={t("clientLabel")}
                    />
                </div>
            )}

            {/* Package */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                    <FieldLabel required>{t("packageLabel")}</FieldLabel>
                    <UILink href={`/${workspaceSlug}/finance/packages`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                        {t("managePackagesShortcut")}
                        <UILink.Icon />
                    </UILink>
                </div>
                <Select
                    variant="secondary"
                    fullWidth
                    placeholder={t("selectPackage")}
                    value={pkgKey}
                    onChange={(key) => {
                        setPkgKey(key);
                        setPkg(packageOptions.find(p => p.key === key) || null);
                    }}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {packageOptions.map(p => (
                                <ListBox.Item key={p.key} id={p.key} textValue={p.label}>
                                    {p.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
                {pkg && (
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{t("durationInfo")} <span className="text-foreground font-medium">{t("durationDays", { count: pkg.duration })}</span></span>
                        <span>{t("priceInfo")} <span className="text-foreground font-medium">{pkg.price.toLocaleString(locale)} {pkg.currency}</span></span>
                    </div>
                )}
                {/* Edit: a stored package no longer in the list still needs to show its values. */}
                {!pkg && pkgKey && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {pkgKey} · {transaction?.amount} {transaction?.currency}
                        {transaction?.duration ? ` · ${t("durationDays", { count: transaction.duration })}` : ""}
                    </p>
                )}
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                    <FieldLabel required>{t("paymentMethodLabel")}</FieldLabel>
                    <UILink href={`/${workspaceSlug}/finance/payment-methods`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                        {t("managePaymentMethodsShortcut")}
                        <UILink.Icon />
                    </UILink>
                </div>
                <Select variant="secondary" fullWidth placeholder={t("selectMethod")} value={method} onChange={setMethod}>
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {paymentMethodOptions.map(m => (
                                <ListBox.Item key={m} id={m} textValue={m}>
                                    {m}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>

            {/* Transaction Date */}
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("txDateLabel")}</FieldLabel>
                <DatePickerField
                    ariaLabel={t("txDateLabel")}
                    value={strToDate(date)}
                    onChange={(dv) => setDate(dv ? dv.toString() : "")}
                />
            </div>

            {/* Subscription Start — toggle automatic vs a specific date. The date
                picker stays visible but is disabled while "automatic" is selected. */}
            <div className="flex flex-col gap-2">
                <Label>{t("subStartDateLabel")}</Label>
                <Switch
                    isSelected={subStartMode === "auto"}
                    onChange={(sel) => {
                        setSubStartMode(sel ? "auto" : "custom");
                        if (sel) setSubStartDate("");
                    }}
                >
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                        <Label className="text-sm">{autoToggleLabel}</Label>
                    </Switch.Content>
                </Switch>
                <p className="text-xs text-muted-foreground">
                    {subStartMode === "auto" ? autoHint : t("subStartHintCustom")}
                </p>
                <DatePickerField
                    ariaLabel={t("subStartDateLabel")}
                    value={strToDate(subStartDate)}
                    onChange={(dv) => setSubStartDate(dv ? dv.toString() : "")}
                    isDisabled={subStartMode === "auto"}
                />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("notesLabel")} <span className="font-normal opacity-60">{t("notesHint")}</span></FieldLabel>
                <TextArea
                    variant="secondary"
                    fullWidth
                    rows={2}
                    aria-label={t("notesLabel")}
                    placeholder={t("notesPlaceholder")}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />
            </div>

            {/* Proof of payment */}
            <div className="flex flex-col gap-1.5">
                <Label>{t("proofLabel")} <span className="font-normal opacity-60">{t("proofOptional")}</span></Label>
                {proofUrl && !proofFile && (
                    <div className="flex items-center gap-2 mb-1">
                        <a href={`${process.env.NEXT_PUBLIC_API_URL}${proofUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                            {t("viewCurrentProof")}
                        </a>
                        <button type="button" onClick={() => setProofUrl(null)} className="text-xs text-destructive hover:underline cursor-pointer">
                            {t("removeProof")}
                        </button>
                    </div>
                )}
                <ProofDropZone
                    file={proofFile}
                    onChange={setProofFile}
                    label={t("proofDropLabel")}
                    hint={t("proofDropHint")}
                    removeLabel={t("removeProof")}
                />
            </div>

            <FieldErrorText msg={error} />

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    {tCommon("cancel")}
                </Button>
                <Button type="submit" variant="primary" isDisabled={saving}>
                    {submitLabel}
                </Button>
            </ModalFooter>
        </form>
    );
}

/**
 * Shared transaction modal — the single place to add or edit a subscription
 * transaction. Used by:
 *   - the clients list (bulk add: one record per selected client),
 *   - a client's transactions page (add + edit for one fixed client),
 *   - the finance transactions page (add + edit with a client picker).
 *
 * Subscription start: a toggle controls whether the start is decided automatically
 * (no custom date) or set to a specific date. The automatic option is labelled
 * dynamically per the target client's history:
 *   - first subscription    → "Start on first plan activation"
 *   - already subscribed     → "Queue after current subscription"
 *   - bulk / mixed / unknown → "Start automatically"
 * The backend makes the final on_first_plan/queued decision; this is the label only.
 *
 * @param {boolean}  open
 * @param {() => void} onClose
 * @param {"add"|"edit"} [mode="add"]
 * @param {any}      [transaction]        the transaction being edited (mode="edit")
 * @param {{ id: string, name?: string }[]} [clients]   fixed target client(s); bulk when length > 1
 * @param {boolean}  [clientPicker=false] render a searchable client picker instead of fixed targets
 * @param {any[]}    [pickerClients=[]]   full client list to pick from (clientPicker)
 * @param {any[]}    packages             raw /api/packages response
 * @param {any[]}    paymentMethods       raw /api/payment-methods response (active filtered inside)
 * @param {(clientId: string) => boolean} [getClientHasSubscription]  drives the start label;
 *        in edit mode the caller should exclude the transaction being edited.
 * @param {(result: any|any[]) => void | Promise<void>} onSuccess  add → array of created; edit → updated
 */
export default function TransactionModal({
    open,
    onClose,
    mode = "add",
    transaction = null,
    clients = [],
    clientPicker = false,
    pickerClients = [],
    packages,
    paymentMethods,
    getClientHasSubscription,
    onSuccess,
}) {
    const t = useTranslations("transactionModal");
    const isEdit = mode === "edit";
    const isBulk = !clientPicker && clients.length > 1;
    const title = isEdit ? t("titleEdit") : isBulk ? t("titleBulk") : t("title");

    return (
        <Modal open={open} onClose={onClose} title={title} dialogClassName="max-w-[27.3rem]">
            {open && (
                <TransactionForm
                    onClose={onClose}
                    mode={mode}
                    transaction={transaction}
                    isBulk={isBulk}
                    clientPicker={clientPicker}
                    pickerClients={pickerClients}
                    clients={clients}
                    packages={packages}
                    paymentMethods={paymentMethods}
                    getClientHasSubscription={getClientHasSubscription}
                    onSuccess={onSuccess}
                />
            )}
        </Modal>
    );
}
