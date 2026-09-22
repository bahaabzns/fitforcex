"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Eye, EyeOff, Copy, Check, Trash2, Archive, RotateCcw, AlertTriangle, History, TrendingUp, NotebookText, Plus, Camera } from 'lucide-react';
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import Modal, { ModalFooter } from "@/app/components/Modal";
import Typography from "@/app/components/Typography";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import CountryCodeSelect from "@/app/components/CountryCodeSelect";
import AreaChart from "@/app/components/charts/AreaChart";
import ObservationModal from "@/app/components/ObservationModal";
import ObservationCard from "@/app/components/ObservationCard";
import { usePageHeaderActions } from "@/app/contexts/pageHeaderActions";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { InputGroup } from "@heroui/react/input-group";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { DateField } from "@heroui/react/date-field";
import { Tabs } from "@heroui/react";
import { toStartOfDay, toEndOfDay, filterByRange, rangeForDays, PRESETS, deltaInfo } from "@/utils/chartDateRange";
import TriggerInsightBannerGroup from "@/app/components/insights/TriggerInsightBannerGroup";

function MetricChart({ metric, locale, startDate, endDate }) {
    const filtered  = useMemo(() => filterByRange(metric.history, startDate, endDate), [metric.history, startDate, endDate]);
    const chartData = useMemo(() => filtered.map(h => ({
        label: new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: parseFloat(h.value) || 0,
    })), [filtered, locale]);
    const info = deltaInfo(filtered);
    const nums = useMemo(() => filtered.map(h => parseFloat(h.value)).filter(v => !isNaN(v)), [filtered]);
    return (
        <AreaChart
            data={chartData}
            height={180}
            formatValue={v => v.toFixed(1)}
            label={metric.name}
            title={metric.name}
            currentValue={nums.length > 0 ? nums[nums.length - 1] : null}
            startValue={nums.length > 1 ? nums[0] : null}
            unit={metric.unit || null}
            readingsCount={filtered.length}
            delta={info?.delta ?? null}
        />
    );
}

function ComparisonSlider({ before, after, locale }) {
    const [position, setPosition] = useState(50);
    const containerRef = useRef(null);
    const dragging = useRef(false);

    const updatePosition = useCallback((clientX) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPosition(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
    }, []);

    const onMouseMove = useCallback((e) => { if (dragging.current) updatePosition(e.clientX); }, [updatePosition]);
    const onMouseUp   = useCallback(() => { dragging.current = false; }, []);
    const onTouchMove = useCallback((e) => { e.preventDefault(); updatePosition(e.touches[0].clientX); }, [updatePosition]);

    useEffect(() => {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup',   onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup',   onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    const fmtDate = (d) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden rounded-xl select-none"
            style={{ cursor: 'col-resize' }}
            onTouchMove={onTouchMove}
            onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
        >
            <img src={after.value} alt="after" className="w-full block max-h-120 object-cover" draggable={false} />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
                <img src={before.value} alt="before" className="w-full h-full object-cover absolute inset-0" draggable={false} />
            </div>
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)] z-10"
                style={{ left: `${position}%` }}
                onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
                onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
            >
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center gap-0.5 z-20"
                    onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <polyline points="15 18 9 12 15 6"/><polyline points="9 18 3 12 9 6"/>
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground -ml-1">
                        <polyline points="9 18 15 12 9 6"/><polyline points="15 18 21 12 15 6"/>
                    </svg>
                </div>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-md pointer-events-none z-10">{fmtDate(before.date)}</div>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-md pointer-events-none z-10">{fmtDate(after.date)}</div>
            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded pointer-events-none z-10">Before</div>
            <div className="absolute top-2 right-2 bg-primary/80 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded pointer-events-none z-10">After</div>
        </div>
    );
}

function PhotoGallery({ metric, locale, startDate, endDate }) {
    const [lightbox, setLightbox]       = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [selected, setSelected]       = useState([]);

    const photos = useMemo(
        () => filterByRange([...metric.history].reverse(), startDate, endDate),
        [metric.history, startDate, endDate]
    );

    useEffect(() => { setCompareMode(false); setSelected([]); setLightbox(null); }, [startDate, endDate]);

    function toggleSelect(photo) {
        setSelected(prev => {
            const already = prev.findIndex(p => p === photo);
            if (already !== -1) return prev.filter((_, i) => i !== already);
            if (prev.length >= 2) return [prev[1], photo];
            return [...prev, photo];
        });
    }

    function enterCompare() {
        setSelected(photos.length >= 2 ? [photos[photos.length - 1], photos[0]] : []);
        setCompareMode(true);
    }

    const canCompare = photos.length >= 2;

    return (
        <Card>
            <Card.Header>
                <div className="flex items-center gap-2 w-full">
                    <Camera size={18} className="shrink-0 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">{metric.name}</p>
                    <Chip size="sm" variant="soft">
                        <Chip.Label>{photos.length} photo{photos.length !== 1 ? "s" : ""}</Chip.Label>
                    </Chip>
                    <div className="flex items-center gap-2 shrink-0">
                        {compareMode ? (
                            <>
                                <span className="text-xs text-muted-foreground">{selected.length}/2 selected</span>
                                <Button size="sm" variant="outline" onClick={() => { setCompareMode(false); setSelected([]); }}>Exit</Button>
                            </>
                        ) : (
                            canCompare && <Button size="sm" variant="outline" onClick={enterCompare}>Compare</Button>
                        )}
                    </div>
                </div>
            </Card.Header>
            <Card.Content className="pt-0">
                {compareMode && selected.length === 2 && (
                    <div className="mb-4">
                        <ComparisonSlider before={selected[0]} after={selected[1]} locale={locale} />
                        <p className="text-[10px] text-muted-foreground text-center mt-1.5">Drag the handle to compare</p>
                    </div>
                )}
                {compareMode && selected.length < 2 && (
                    <div className="mb-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                        <p className="text-xs text-primary">
                            {selected.length === 0 ? "Select a before photo" : "Now select an after photo"}
                        </p>
                    </div>
                )}
                {photos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No photos in this range</p>
                ) : (
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {photos.map((h, i) => {
                            const selIdx     = selected.indexOf(h);
                            const isSelected = selIdx !== -1;
                            return (
                                <button key={i} onClick={() => compareMode ? toggleSelect(h) : setLightbox(h)} className="cursor-pointer shrink-0 flex flex-col gap-1.5 relative">
                                    <img
                                        src={h.value}
                                        alt={metric.name}
                                        className={`w-28 h-36 object-cover rounded-xl border-2 transition-all ${isSelected ? "border-primary shadow-[0_0_0_2px_var(--primary)]" : "border-border hover:border-primary/50"}`}
                                        draggable={false}
                                    />
                                    {isSelected && (
                                        <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow">{selIdx + 1}</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground text-center">
                                        {new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </Card.Content>
            {lightbox && !compareMode && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <img src={lightbox.value} alt={metric.name} className="max-w-full max-h-full rounded-xl object-contain" />
                    <span className="absolute top-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded-lg">
                        {new Date(lightbox.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                </div>
            )}
        </Card>
    );
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const BLANK_PHONE = { countryCode: "+20", number: "" };

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientOverviewPage() {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { formatDate } = useDateFormatter();

  // Edit form state
  const [formData, setFormData] = useState({ fname: "", lname: "", email: "" });
  const [editPhones, setEditPhones] = useState([{ ...BLANK_PHONE }]);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [tempPassword, setTempPassword] = useState(null);
  const [showStoredPassword, setShowStoredPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lifecycle
  const [me, setMe] = useState(null);
  const [audit, setAudit] = useState([]);
  const [actionMsg, setActionMsg] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStrategy, setDeleteStrategy] = useState("anonymize");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Transformation
  const [txData, setTxData]       = useState(null);
  const [txLoading, setTxLoading] = useState(true);
  const [dateRange, setDateRange] = useState(rangeForDays(90));
  const [activePreset, setActivePreset] = useState("90d");
  const setPageHeaderActions = usePageHeaderActions();

  // Recent observations (preview widget — full history lives on the Observations tab)
  const [recentObservations, setRecentObservations] = useState([]);
  const [observationsLoading, setObservationsLoading] = useState(true);
  const [observationModalOpen, setObservationModalOpen] = useState(false);
  const [editingObservation, setEditingObservation] = useState(null);

  const { id, workspaceSlug } = useParams();
  const router = useRouter();

  const isOwner = me?.currentWorkspace?.role === "owner";

  const scrollCleanupRef = useRef(null);
  const scrollMaskRef = useCallback((el) => {
    if (scrollCleanupRef.current) { scrollCleanupRef.current(); scrollCleanupRef.current = null; }
    if (!el) return;
    function update() {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const top    = scrollTop > 0;
      const bottom = scrollTop + clientHeight < scrollHeight - 1;
      if (!top && !bottom) el.style.maskImage = "none";
      else if (!top)       el.style.maskImage = "linear-gradient(to bottom, black calc(100% - 20px), transparent)";
      else if (!bottom)    el.style.maskImage = "linear-gradient(to bottom, transparent, black 20px)";
      else                 el.style.maskImage = "linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)";
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    scrollCleanupRef.current = () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  function loadAudit() {
    api.get(`/api/clients/${id}/audit`)
      .then(res => setAudit(res.data ?? []))
      .catch(() => setAudit([]));
  }

  useEffect(() => {
    api.get(`/api/clients/${id}`)
      .then(res => setClient(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    api.get("/api/auth/me").then(res => setMe(res.data)).catch(() => {});
    loadAudit();
    api.get(`/api/clients/${id}/transformation`)
      .then(res => setTxData(res.data))
      .catch(() => {})
      .finally(() => setTxLoading(false));
    api.get(`/api/clients/${id}/observations?limit=3`)
      .then(res => setRecentObservations(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRecentObservations([]))
      .finally(() => setObservationsLoading(false));
  }, [id]);

  const startDate = useMemo(() => dateRange ? toStartOfDay(dateRange.start) : null, [dateRange]);
  const endDate   = useMemo(() => dateRange ? toEndOfDay(dateRange.end)   : null, [dateRange]);

  const applyPreset = useCallback((preset) => {
    setActivePreset(preset.label);
    setDateRange(preset.days === null ? null : rangeForDays(preset.days));
  }, []);

  const handlePickerChange = useCallback((range) => {
    setDateRange(range);
    setActivePreset(null);
  }, []);

  const numericMetrics     = useMemo(() => (txData?.metrics ?? []).filter(m => m.type === "number"), [txData]);
  const imageMetrics       = useMemo(() => (txData?.metrics ?? []).filter(m => m.type === "image"),  [txData]);
  const hasTransformation  = numericMetrics.length > 0 || imageMetrics.length > 0;

  // Inject the date-range toolbar into the layout header slot when there's data.
  useEffect(() => {
    if (!setPageHeaderActions || !hasTransformation) return;
    setPageHeaderActions(
      <div className="flex items-center gap-2">
        <DateRangePicker value={dateRange} onChange={handlePickerChange}>
          <DateField.Group fullWidth>
            <DateField.Input slot="start">
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateRangePicker.RangeSeparator />
            <DateField.Input slot="end">
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateField.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover>
            <RangeCalendar aria-label="Date range">
              <RangeCalendar.Header>
                <RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.YearPickerTriggerHeading />
                  <RangeCalendar.YearPickerTriggerIndicator />
                </RangeCalendar.YearPickerTrigger>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
              <RangeCalendar.YearPickerGrid>
                <RangeCalendar.YearPickerGridBody>
                  {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                </RangeCalendar.YearPickerGridBody>
              </RangeCalendar.YearPickerGrid>
            </RangeCalendar>
          </DateRangePicker.Popover>
        </DateRangePicker>
        <Tabs
          selectedKey={activePreset}
          onSelectionChange={(key) => applyPreset(PRESETS.find(p => p.label === key))}
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Timeframe"
              className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
            >
              {PRESETS.map(p => (
                <Tabs.Tab key={p.label} id={p.label}>
                  {p.label}
                  <Tabs.Indicator className="bg-accent" />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>
    );
    return () => setPageHeaderActions(null);
  }, [activePreset, dateRange, applyPreset, handlePickerChange, setPageHeaderActions, hasTransformation]);

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function updateEditPhone(index, field, value) {
    setEditPhones(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  }
  function addEditPhone()         { setEditPhones(prev => prev.length >= 3 ? prev : [...prev, { ...BLANK_PHONE }]); }
  function removeEditPhone(index) { setEditPhones(prev => prev.filter((_, i) => i !== index)); }

  function openEdit() {
    const phones = (client.phones && client.phones.length > 0)
      ? client.phones
      : (client.phone ? [{ countryCode: "", number: client.phone }] : []);
    setFormData({ fname: client.fname, lname: client.lname, email: client.email });
    setEditPhones(phones.length > 0 ? phones.slice(0, 3).map(p => ({ ...p })) : [{ ...BLANK_PHONE }]);
    setNewPassword(""); setPasswordError(""); setShowNewPassword(false);
    setShowEditForm(true);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword && newPassword.length < 6) { setPasswordError(t('passwordMinLength')); return; }
    const phonesToSend = editPhones.filter(p => p.number.trim());
    try {
      const updated = await api.put(`/api/clients/${id}`, { ...formData, phones: phonesToSend });
      let updatedClient = { ...client, ...updated.data };
      if (newPassword) {
        await api.post(`/api/clients/${id}/set-password`, { password: newPassword });
        setTempPassword(newPassword);
        updatedClient = { ...updatedClient, has_password: true };
      }
      setClient(updatedClient);
      setShowEditForm(false);
      setNewPassword("");
    } catch (error) {
      console.error("Error updating client:", error);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.delete(`/api/clients/${id}`);
      setShowArchiveModal(false);
      router.push(`/${workspaceSlug}/clients`);
    } catch (error) {
      console.error("Error archiving client:", error);
      setArchiving(false);
    }
  }

  async function handleRestore() {
    setRestoring(true); setActionMsg("");
    try {
      const { data } = await api.post(`/api/clients/${id}/restore`);
      setClient(prev => ({ ...prev, ...data }));
      setActionMsg(t('restoreSuccess'));
      loadAudit();
    } catch (error) {
      console.error("Error restoring client:", error);
    } finally {
      setRestoring(false);
    }
  }

  async function handlePermanentDelete() {
    setDeleteError(""); setDeleting(true);
    try {
      await api.delete(`/api/clients/${id}/permanent`, { data: { confirmName: deleteConfirmName.trim(), strategy: deleteStrategy } });
      setShowDeleteModal(false);
      router.push(`/${workspaceSlug}/clients`);
    } catch (error) {
      const msg = error.response?.data?.error;
      setDeleteError(msg === "name_mismatch" ? t('nameMismatch') : (msg || t('deleteFailed')));
      setDeleting(false);
    }
  }

  const copyCredentials = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(`Email: ${client.email}\nPassword: ${tempPassword}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const fullName = client ? `${client.fname} ${client.lname}`.trim() : "";

  function timelineLabel(ev) {
    switch (ev.eventType) {
      case "client.archive": return t('timelineArchived');
      case "client.restore": return t('timelineRestored');
      case "client.delete":  return t('timelineDeleted');
      case "status.change":  return t('timelineStatusChange', { from: ev.fromStatus || "—", to: ev.toStatus || "—" });
      default:               return ev.eventType;
    }
  }

  function actorLabel(ev) {
    if (ev.actorType === "system") return t('actorSystem');
    if (me?.id && ev.actorUserId === me.id) return t('actorYou');
    return t('actorCoach');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {loading ? (
        <div ref={scrollMaskRef} className="h-full overflow-y-auto scrollbar-hide">
          <div className="flex flex-col gap-4 pb-6">
            {[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        </div>
      ) : !client ? (
        <div className="text-muted-foreground pt-4">{t('clientNotFound')}</div>
      ) : (
        <div ref={scrollMaskRef} className="h-full overflow-y-auto scrollbar-hide">
        <div className="flex flex-col gap-6 pb-6">

          {/* Header */}
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground flex-1 flex items-center gap-3">
              <span>#{client.code ?? client.client_code} — {client.fname} {client.lname}</span>
              {client.is_archived && <Chip size="sm" variant="soft" color="default">{t('statusArchived')}</Chip>}
            </h1>
            {client.is_archived ? (
              <Button onClick={handleRestore} variant="primary" size="sm" isDisabled={restoring}>
                <RotateCcw size={15} />
                {restoring ? t('restoring') : t('restoreClient')}
              </Button>
            ) : (
              <>
                <Button onClick={openEdit} variant="primary" size="sm">{tCommon('edit')}</Button>
                <Button onClick={() => setShowArchiveModal(true)} className="bg-destructive/10 hover:bg-destructive/20 text-destructive" size="sm">
                  <Archive size={15} />{t('archiveAction')}
                </Button>
              </>
            )}
          </div>

          <TriggerInsightBannerGroup
            basePath="/api/insights"
            events={["first_subscription_freeze_created", "first_package_variation_assigned_to_client"]}
          />

          {actionMsg && (
            <p className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <Check size={14} className="shrink-0" /> {actionMsg}
            </p>
          )}

          {client.is_archived && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <Archive size={18} className="text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t('archivedBannerTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('archivedBannerDesc')}</p>
              </div>
            </div>
          )}

          {/* Client info */}
          <Card>
            <Card.Content className="p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:flex lg:divide-x lg:divide-border lg:[&>*:first-child]:pl-0 lg:[&>*]:pl-8 lg:[&>*]:pr-8 lg:[&>*:last-child]:pr-0 lg:[&>*]:flex-1 lg:gap-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{t('emailFieldLabel')}</span>
                  <span className="text-sm text-foreground">{client.email || "—"}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{t('colPhone')}</span>
                  <div className="flex flex-col gap-0.5">
                    {(client.phones && client.phones.length > 0)
                      ? client.phones.map((p, i) => (
                          <span key={i} className={`text-sm ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{p.countryCode} {p.number}</span>
                        ))
                      : <span className="text-sm text-foreground">{client.phone || "—"}</span>
                    }
                  </div>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{t('clientCodeLabel')}</span>
                  <span className="text-sm font-semibold text-primary">#{client.code ?? client.client_code}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{t('packageLabel')}</span>
                  <span className="text-sm text-foreground">{client.current_package || "—"}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{t('portalPassword')}</span>
                  <div className="flex items-center gap-1.5">
                    {tempPassword ? (
                      <>
                        <span className="font-mono text-sm text-foreground">
                          {showStoredPassword ? tempPassword : "•".repeat(tempPassword.length)}
                        </span>
                        <button onClick={() => setShowStoredPassword(v => !v)} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                          {showStoredPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </>
                    ) : client.has_password ? (
                      <span className="text-sm text-muted-foreground italic">{t('passwordSetHint')}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('passwordNotSet')}</span>
                    )}
                  </div>
                </div>
              </div>
              {tempPassword && (
                <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                    {t('savePasswordWarning')}
                  </p>
                  <Button onClick={copyCredentials} variant="outline" size="sm" className="self-start">
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? t('copied') : t('copyCredentials')}
                  </Button>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Recent Observations + Activity Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Card.Content className="p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <NotebookText size={16} className="text-muted-foreground" />
                    {t('recentObservations')}
                  </h2>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onPress={() => { setEditingObservation(null); setObservationModalOpen(true); }}>
                      <Plus size={13} /> {t('addObservation')}
                    </Button>
                    <Link
                      href={`/${workspaceSlug}/clients/${id}/observations`}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t('viewAllObservations')}
                    </Link>
                  </div>
                </div>
                {observationsLoading ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : recentObservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noObservationsYet')}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentObservations.map(o => (
                      <ObservationCard
                        key={o.id}
                        observation={o}
                        clientId={id}
                        currentUserId={me?.userId}
                        isOwner={isOwner}
                        onEdit={(obs) => { setEditingObservation(obs); setObservationModalOpen(true); }}
                        onDeleted={(deletedId) => setRecentObservations(prev => prev.filter(x => x.id !== deletedId))}
                      />
                    ))}
                  </div>
                )}
              </Card.Content>
            </Card>

            {/* Activity timeline */}
            <Card>
              <Card.Content className="p-6">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <History size={16} className="text-muted-foreground" />
                  {t('activityTimeline')}
                </h2>
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {audit.map(ev => (
                      <li key={ev.id} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{timelineLabel(ev)}</p>
                          <p className="text-xs text-muted-foreground">{actorLabel(ev)} · {formatDate(ev.createdAt) || ""}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card.Content>
            </Card>
          </div>
          <ObservationModal
            open={observationModalOpen}
            onClose={() => setObservationModalOpen(false)}
            clientId={id}
            observation={editingObservation}
            onCreated={(obs) => setRecentObservations(prev => [obs, ...prev].slice(0, 3))}
            onUpdated={(updated) => setRecentObservations(prev => prev.map(x => x.id === updated.id ? updated : x))}
          />

          {/* Transformation */}
          <section>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-muted-foreground" />
              Transformation
            </h2>
            {txLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : !hasTransformation ? (
              <p className="text-sm text-muted-foreground">
                No transformation data yet. Data appears here once the client submits a form with tracked metric questions.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {numericMetrics.length > 0 && (
                  <div>
                    <Typography as="h3" type="body-sm" weight="semibold" color="muted" className="uppercase tracking-wider mb-3">
                      Measurements
                    </Typography>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      {numericMetrics.map(m => (
                        <MetricChart key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                      ))}
                    </div>
                  </div>
                )}
                {imageMetrics.length > 0 && (
                  <div>
                    <Typography as="h3" type="body-sm" weight="semibold" color="muted" className="uppercase tracking-wider mb-3">
                      Progress Photos
                    </Typography>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      {imageMetrics.map(m => (
                        <PhotoGallery key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Danger zone */}
          {client.is_archived && isOwner && (
            <Card className="border-destructive/30">
              <Card.Content className="p-6">
                <h2 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} />{t('dangerZone')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">{t('permanentDeleteDesc')}</p>
                <Button
                  onClick={() => { setDeleteConfirmName(""); setDeleteStrategy("anonymize"); setDeleteError(""); setShowDeleteModal(true); }}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  size="sm"
                >
                  <Trash2 size={15} />{t('permanentDelete')}
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* Archive modal */}
          <Modal open={showArchiveModal} onClose={() => setShowArchiveModal(false)} title={t('archiveClientTitle')}>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{t('archiveClientDesc')}</p>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setShowArchiveModal(false)} isDisabled={archiving}>{tCommon('cancel')}</Button>
                <Button onClick={handleArchive} isDisabled={archiving} className="bg-destructive hover:bg-destructive/90 text-white">
                  <Archive size={15} />{archiving ? t('archiving') : t('archiveClientConfirm')}
                </Button>
              </ModalFooter>
            </div>
          </Modal>

          {/* Permanent delete modal */}
          <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title={t('permanentDelete')}>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{t('permanentDeleteWarning')}</p>
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel>{t('deleteStrategyLabel')}</FieldLabel>
                {[
                  { key: "anonymize", title: t('anonymizeTitle'), desc: t('anonymizeDesc'), recommended: true },
                  { key: "hard",      title: t('hardTitle'),      desc: t('hardDesc'),      recommended: false },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDeleteStrategy(opt.key)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                      deleteStrategy === opt.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${deleteStrategy === opt.key ? "border-primary" : "border-muted-foreground"}`}>
                      {deleteStrategy === opt.key && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {opt.title}
                        {opt.recommended && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t('recommended')}</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>{t('permanentDeleteConfirmLabel', { name: fullName })}</FieldLabel>
                <TextField variant="secondary" fullWidth aria-label={t('permanentDeleteConfirmLabel', { name: fullName })} value={deleteConfirmName} onChange={setDeleteConfirmName} isInvalid={!!deleteError}>
                  <Input type="text" placeholder={t('permanentDeleteConfirmPlaceholder')} autoFocus />
                </TextField>
                <FieldErrorText msg={deleteError} />
              </div>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setShowDeleteModal(false)} isDisabled={deleting}>{tCommon('cancel')}</Button>
                <Button onClick={handlePermanentDelete} isDisabled={deleting || deleteConfirmName.trim() !== fullName} className="bg-destructive hover:bg-destructive/90 text-white">
                  <Trash2 size={15} />{deleting ? t('deleting') : t('permanentDeleteButton')}
                </Button>
              </ModalFooter>
            </div>
          </Modal>

          {/* Edit modal */}
          <Modal open={showEditForm} onClose={() => setShowEditForm(false)} title={t('editClientTitle')}>
            <form onSubmit={handleUpdate} className="flex flex-col gap-5 px-1 py-1">
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel required>{t('firstName')}</FieldLabel>
                  <TextField variant="secondary" fullWidth isRequired aria-label={t('firstName')} value={formData.fname} onChange={(val) => setFormData({ ...formData, fname: val })}>
                    <Input type="text" placeholder={t('firstNamePlaceholder')} autoFocus />
                  </TextField>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>{t('lastName')}</FieldLabel>
                  <TextField variant="secondary" fullWidth aria-label={t('lastName')} value={formData.lname} onChange={(val) => setFormData({ ...formData, lname: val })}>
                    <Input type="text" placeholder={t('lastName')} />
                  </TextField>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>{t('emailAddress')}</FieldLabel>
                <TextField variant="secondary" fullWidth isRequired aria-label={t('emailAddress')} value={formData.email} onChange={(val) => setFormData({ ...formData, email: val })}>
                  <Input type="email" placeholder={t('emailPlaceholder')} />
                </TextField>
              </div>
              <div className="flex flex-col gap-3">
                {editPhones.map((phone, i) => {
                  const isPrimary  = i === 0;
                  const phoneLabel = isPrimary ? t('primaryPhoneLabel') : t('additionalPhoneLabel', { n: i + 1 });
                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <FieldLabel required={isPrimary}>{phoneLabel}</FieldLabel>
                      <div className="flex gap-2 items-center">
                        <CountryCodeSelect value={phone.countryCode} onChange={code => updateEditPhone(i, "countryCode", code)} />
                        <TextField variant="secondary" fullWidth aria-label={phoneLabel} value={phone.number} onChange={(val) => updateEditPhone(i, "number", val)} className="flex-1">
                          <Input type="text" inputMode="numeric" placeholder={phoneLabel} />
                        </TextField>
                        {!isPrimary && (
                          <Button type="button" variant="ghost" isIconOnly aria-label={t('removePhone')} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeEditPhone(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {editPhones.length < 3 && (
                  <Button type="button" variant="ghost" size="sm" onClick={addEditPhone} className="self-end">
                    {t('addAnotherPhone')}
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <FieldLabel>
                  {t('newPassword')} <span className="font-normal opacity-60">({t('newPasswordHint')})</span>
                </FieldLabel>
                <div className="flex gap-2">
                  <InputGroup variant="secondary" className={`flex-1${passwordError ? " ring-1 ring-destructive rounded-lg" : ""}`}>
                    <InputGroup.Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                      placeholder={t('newPasswordPlaceholder')}
                    />
                    <InputGroup.Suffix>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(v => !v)}
                        aria-label={showNewPassword ? tCommon('hide') : tCommon('show')}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  <Button type="button" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => { setNewPassword(generatePassword()); setShowNewPassword(true); setPasswordError(""); }}>
                    {t('generate')}
                  </Button>
                </div>
                <FieldErrorText msg={passwordError} />
              </div>
              <ModalFooter>
                <Button type="button" variant="ghost" onClick={() => setShowEditForm(false)}>{tCommon('cancel')}</Button>
                <Button type="submit" variant="primary">{t('saveChanges')}</Button>
              </ModalFooter>
            </form>
          </Modal>

        </div>
        </div>
      )}
    </>
  );
}
