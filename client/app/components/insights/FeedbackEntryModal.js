'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bug, Lightbulb, Star, X } from 'lucide-react';
import { Chip } from '@heroui/react/chip';
import { TextArea } from '@heroui/react/textarea';
import { Button } from '@heroui/react/button';
import AppModal, { ModalFooter } from '@/app/components/Modal';
import { FieldLabel, FieldErrorText } from '@/app/components/Field';
import api from '@/lib/axios';

const TYPES = [
    { value: 'bug', icon: Bug },
    { value: 'feature_request', icon: Lightbulb },
    { value: 'rating', icon: Star },
];

/**
 * The Insights System's passive entry point — reachable from a persistent
 * nav/header trigger, never a popup. The coach dashboard and client portal
 * mount this under different route shapes (/api/insights/* vs. the flatter
 * /api/client-portal/insights + /api/client-portal/insights/screenshot — see
 * insights.routes.ts / clientPortal.routes.ts), so the caller passes the
 * exact URLs rather than a basePath this component would have to guess a
 * suffix onto.
 */
export default function FeedbackEntryModal({ open, onClose, submitUrl, screenshotUploadUrl, module: moduleName }) {
    const t = useTranslations('insights.entry');
    const tCommon = useTranslations('common');
    const [type, setType] = useState('bug');
    const [description, setDescription] = useState('');
    const [rating, setRating] = useState(null);
    const [screenshotUrl, setScreenshotUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const fileInputRef = useRef(null);

    function resetState() {
        setType('bug');
        setDescription('');
        setRating(null);
        setScreenshotUrl(null);
        setError('');
        setSent(false);
    }

    function handleClose() {
        if (submitting) return;
        resetState();
        onClose();
    }

    async function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(screenshotUploadUrl, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setScreenshotUrl(res.data.url);
        } catch {
            // Non-blocking — a failed screenshot upload shouldn't stop the
            // report itself from being submittable.
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (type === 'rating') {
            if (!rating) { setError(t('errorRatingRequired')); return; }
        } else if (!description.trim()) {
            setError(t('errorDescriptionRequired'));
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            await api.post(submitUrl, {
                sourceType: type,
                textValue: type === 'rating' ? undefined : description.trim(),
                ratingValue: type === 'rating' ? rating : undefined,
                module: moduleName,
                screenshotUrl,
            });
            setSent(true);
        } catch {
            setError(t('errorSubmitFailed'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AppModal open={open} onClose={handleClose} title={t('title')}>
            {sent ? (
                <div className="flex flex-col items-center text-center gap-2 py-6">
                    <p className="text-base font-medium text-foreground">{t('sentTitle')}</p>
                    <p className="text-sm text-muted-foreground">{t('sentBody')}</p>
                    <Button className="mt-3" variant="primary" onClick={handleClose}>{tCommon('done')}</Button>
                </div>
            ) : (
                <form className="flex flex-col gap-4 px-1 py-1" onSubmit={handleSubmit}>
                    <div className="flex items-center gap-2">
                        {TYPES.map(({ value, icon: Icon }) => (
                            <button key={value} type="button" onClick={() => setType(value)} className="cursor-pointer">
                                <Chip size="sm" variant={type === value ? 'primary' : 'soft'} className="inline-flex items-center gap-1">
                                    <Icon size={13} />
                                    {t(value === 'bug' ? 'typeBug' : value === 'feature_request' ? 'typeFeatureRequest' : 'typeRating')}
                                </Chip>
                            </button>
                        ))}
                    </div>

                    {type === 'rating' ? (
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('ratingLabel')}</FieldLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setRating(n)}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                            rating === n
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-border text-muted-foreground hover:bg-default'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t('descriptionLabel')}</FieldLabel>
                            <TextArea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('descriptionPlaceholder')}
                                rows={4}
                            />
                        </div>
                    )}

                    {type === 'bug' && (
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel>{t('screenshotLabel')}</FieldLabel>
                            {screenshotUrl ? (
                                <div className="flex items-center gap-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={screenshotUrl} alt="" className="h-14 w-14 rounded-lg object-cover border border-border" />
                                    <button
                                        type="button"
                                        onClick={() => setScreenshotUrl(null)}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <X size={12} /> {t('screenshotRemove')}
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    isDisabled={uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? t('screenshotUploading') : t('screenshotAdd')}
                                </Button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    )}

                    <FieldErrorText msg={error} />

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={handleClose}>{tCommon('cancel')}</Button>
                        <Button type="submit" variant="primary" isDisabled={submitting}>
                            {submitting ? t('submitting') : t('submit')}
                        </Button>
                    </ModalFooter>
                </form>
            )}
        </AppModal>
    );
}
