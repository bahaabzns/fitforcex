"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Eye, EyeOff, Copy, Check, Trash2 } from 'lucide-react';
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import CountryCodeSelect from "@/app/components/CountryCodeSelect";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
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

  // Edit form state
  const [formData, setFormData] = useState({ fname: "", lname: "", email: "" });
  const [editPhones, setEditPhones] = useState([{ ...BLANK_PHONE }]);

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [tempPassword, setTempPassword] = useState(null);
  const [showStoredPassword, setShowStoredPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    api.get(`/api/clients/${id}`)
      .then(res => setClient(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
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

  async function handleDelete() {
    if (confirm(t('confirmDeleteClient'))) {
      try {
        await api.delete(`/api/clients/${id}`);
        router.push("/clients");
      } catch (error) {
        console.error("Error deleting client:", error);
      }
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
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground flex-1">
              #{client.code ?? client.client_code} — {client.fname} {client.lname}
            </h1>
            <Button onClick={openEdit} variant="primary" size="sm">
              {tCommon('edit')}
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-destructive/10 hover:bg-destructive/20 text-destructive"
              size="sm"
            >
              {tCommon('delete')}
            </Button>
          </div>

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
