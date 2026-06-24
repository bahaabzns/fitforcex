"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Eye, EyeOff, Copy, Check, Trash2, Archive, RotateCcw, AlertTriangle, History } from 'lucide-react';
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import CountryCodeSelect from "@/app/components/CountryCodeSelect";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { InputGroup } from "@heroui/react/input-group";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const BLANK_PHONE = { countryCode: "+20", number: "" };

export default function ClientOverviewPage() {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
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

  // Lifecycle (archive / restore / permanent delete)
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

  const { id, workspaceSlug } = useParams();
  const router = useRouter();

  const isOwner = me?.currentWorkspace?.role === "owner";

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
  }, [id]);

  function updateEditPhone(index, field, value) {
    setEditPhones(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addEditPhone() {
    setEditPhones(prev => (prev.length >= 3 ? prev : [...prev, { ...BLANK_PHONE }]));
  }

  function removeEditPhone(index) {
    setEditPhones(prev => prev.filter((_, i) => i !== index));
  }

  function openEdit() {
    const phones = (client.phones && client.phones.length > 0)
      ? client.phones
      : (client.phone ? [{ countryCode: "", number: client.phone }] : []);

    setFormData({ fname: client.fname, lname: client.lname, email: client.email });
    setEditPhones(phones.length > 0 ? phones.slice(0, 3).map(p => ({ ...p })) : [{ ...BLANK_PHONE }]);
    setNewPassword("");
    setPasswordError("");
    setShowNewPassword(false);
    setShowEditForm(true);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword && newPassword.length < 6) {
      setPasswordError(t('passwordMinLength'));
      return;
    }
    const phonesToSend = editPhones.filter(p => p.number.trim());
    try {
      const updated = await api.put(`/api/clients/${id}`, {
        ...formData,
        phones: phonesToSend,
      });
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

  // Archiving is the default "delete" — preserves all data, removes from active lists.
  async function handleArchive() {
    setArchiving(true);
    try {
      await api.delete(`/api/clients/${id}`);
      setShowArchiveModal(false);
      // Removed from active lists — return to the clients page.
      router.push(`/${workspaceSlug}/clients`);
    } catch (error) {
      console.error("Error archiving client:", error);
      setArchiving(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    setActionMsg("");
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
    setDeleteError("");
    setDeleting(true);
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
    const text = `Email: ${client.email}\nPassword: ${tempPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fullName = client ? `${client.fname} ${client.lname}`.trim() : "";

  // Map an audit row to a human label for the timeline.
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

  return (
    <>
      {loading ? (
        <div className="p-8 flex flex-col gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : !client ? (
        <div className="p-8 text-muted-foreground">{t('clientNotFound')}</div>
      ) : (
        <div className="p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground flex-1 flex items-center gap-3">
              <span>#{client.code ?? client.client_code} — {client.fname} {client.lname}</span>
              {client.is_archived && (
                <Chip size="sm" variant="soft" color="default">{t('statusArchived')}</Chip>
              )}
            </h1>
            {client.is_archived ? (
              <Button onClick={handleRestore} variant="primary" size="sm" isDisabled={restoring}>
                <RotateCcw size={15} />
                {restoring ? t('restoring') : t('restoreClient')}
              </Button>
            ) : (
              <>
                <Button onClick={openEdit} variant="primary" size="sm">
                  {tCommon('edit')}
                </Button>
                <Button
                  onClick={() => setShowArchiveModal(true)}
                  className="bg-destructive/10 hover:bg-destructive/20 text-destructive"
                  size="sm"
                >
                  <Archive size={15} />
                  {t('archiveAction')}
                </Button>
              </>
            )}
          </div>

          {/* Action success message */}
          {actionMsg && (
            <p className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <Check size={14} className="shrink-0" /> {actionMsg}
            </p>
          )}

          {/* Archived banner */}
          {client.is_archived && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <Archive size={18} className="text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t('archivedBannerTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('archivedBannerDesc')}</p>
              </div>
            </div>
          )}

          {/* Info Card */}
          <Card>
            <Card.Content className="p-6">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">{t('emailFieldLabel')}</span>
                <span className="text-sm text-foreground">{client.email || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">{t('colPhone')}</span>
                <div className="flex flex-col gap-0.5">
                  {(client.phones && client.phones.length > 0)
                    ? client.phones.map((p, i) => (
                        <span key={i} className={`text-sm ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {p.countryCode} {p.number}
                        </span>
                      ))
                    : <span className="text-sm text-foreground">{client.phone || "—"}</span>
                  }
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">{t('clientCodeLabel')}</span>
                <span className="text-sm font-semibold text-primary">#{client.code ?? client.client_code}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">{t('packageLabel')}</span>
                <span className="text-sm text-foreground">{client.current_package || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">{t('portalPassword')}</span>
                {tempPassword ? (
                  <>
                    <span className="font-mono text-sm text-foreground">
                      {showStoredPassword ? tempPassword : "•".repeat(tempPassword.length)}
                    </span>
                    <button
                      onClick={() => setShowStoredPassword(v => !v)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      {showStoredPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </>
                ) : client.has_password ? (
                  <span className="text-sm text-muted-foreground italic">{t('passwordSetHint')}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('passwordNotSet')}</span>
                )}
              </div>
              {tempPassword && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                    {t('savePasswordWarning')}
                  </p>
                  <Button
                    onClick={copyCredentials}
                    variant="outline"
                    size="sm"
                    className="self-start"
                  >
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? t('copied') : t('copyCredentials')}
                  </Button>
                </div>
              )}
            </div>
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
                        <p className="text-xs text-muted-foreground">
                          {actorLabel(ev)} · {formatDate(ev.createdAt) || ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Content>
          </Card>

          {/* Danger zone — archived clients only, owner only */}
          {client.is_archived && isOwner && (
            <Card className="border-destructive/30">
              <Card.Content className="p-6">
                <h2 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} />
                  {t('dangerZone')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">{t('permanentDeleteDesc')}</p>
                <Button
                  onClick={() => { setDeleteConfirmName(""); setDeleteStrategy("anonymize"); setDeleteError(""); setShowDeleteModal(true); }}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  size="sm"
                >
                  <Trash2 size={15} />
                  {t('permanentDelete')}
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* Archive confirmation modal */}
          <Modal open={showArchiveModal} onClose={() => setShowArchiveModal(false)} title={t('archiveClientTitle')}>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{t('archiveClientDesc')}</p>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setShowArchiveModal(false)} isDisabled={archiving}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  onClick={handleArchive}
                  isDisabled={archiving}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  <Archive size={15} />
                  {archiving ? t('archiving') : t('archiveClientConfirm')}
                </Button>
              </ModalFooter>
            </div>
          </Modal>

          {/* Permanent delete modal — type-to-confirm */}
          <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title={t('permanentDelete')}>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{t('permanentDeleteWarning')}</p>
              </div>

              {/* Deletion strategy — chosen per-deletion */}
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
                    <span className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                      deleteStrategy === opt.key ? "border-primary" : "border-muted-foreground"
                    }`}>
                      {deleteStrategy === opt.key && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {opt.title}
                        {opt.recommended && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t('recommended')}</span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>{t('permanentDeleteConfirmLabel', { name: fullName })}</FieldLabel>
                <TextField
                  variant="secondary"
                  fullWidth
                  aria-label={t('permanentDeleteConfirmLabel', { name: fullName })}
                  value={deleteConfirmName}
                  onChange={setDeleteConfirmName}
                  isInvalid={!!deleteError}
                >
                  <Input type="text" placeholder={t('permanentDeleteConfirmPlaceholder')} autoFocus />
                </TextField>
                <FieldErrorText msg={deleteError} />
              </div>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setShowDeleteModal(false)} isDisabled={deleting}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  onClick={handlePermanentDelete}
                  isDisabled={deleting || deleteConfirmName.trim() !== fullName}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  <Trash2 size={15} />
                  {deleting ? t('deleting') : t('permanentDeleteButton')}
                </Button>
              </ModalFooter>
            </div>
          </Modal>

          {/* Edit Modal */}
          <Modal open={showEditForm} onClose={() => setShowEditForm(false)} title={t('editClientTitle')}>
            <form onSubmit={handleUpdate} className="flex flex-col gap-5 px-1 py-1">
              {/* First + Last name */}
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

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>{t('emailAddress')}</FieldLabel>
                <TextField variant="secondary" fullWidth isRequired aria-label={t('emailAddress')} value={formData.email} onChange={(val) => setFormData({ ...formData, email: val })}>
                  <Input type="email" placeholder={t('emailPlaceholder')} />
                </TextField>
              </div>

              {/* Phone numbers */}
              <div className="flex flex-col gap-3">
                {editPhones.map((phone, i) => {
                  const isPrimary = i === 0;
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
                          <Button
                            type="button"
                            variant="ghost"
                            isIconOnly
                            aria-label={t('removePhone')}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeEditPhone(i)}
                          >
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

              {/* Password */}
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
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 whitespace-nowrap"
                    onClick={() => { setNewPassword(generatePassword()); setShowNewPassword(true); setPasswordError(""); }}
                  >
                    {t('generate')}
                  </Button>
                </div>
                <FieldErrorText msg={passwordError} />
              </div>

              <ModalFooter>
                <Button type="button" variant="ghost" onClick={() => setShowEditForm(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" variant="primary">
                  {t('saveChanges')}
                </Button>
              </ModalFooter>
            </form>
          </Modal>
        </div>
      )}
    </>
  );
}
