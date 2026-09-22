'use client';

import { useTranslations } from 'next-intl';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';

const CONTACT_EMAIL = 'support@fitforce.app';
const CONTACT_PHONE = '+201501233314';
const CONTACT_PHONE_DISPLAY = '+20 150 123 3314';

export default function ContactUsContent() {
    const t = useTranslations('contactUs');

    const cards = [
        {
            key: 'email',
            icon: Mail,
            heading: t('sections.email.heading'),
            body: t('sections.email.body'),
            value: CONTACT_EMAIL,
            href: `mailto:${CONTACT_EMAIL}`,
        },
        {
            key: 'phone',
            icon: Phone,
            heading: t('sections.phone.heading'),
            body: t('sections.phone.body'),
            value: CONTACT_PHONE_DISPLAY,
            href: `tel:${CONTACT_PHONE}`,
        },
        {
            key: 'address',
            icon: MapPin,
            heading: t('sections.address.heading'),
            body: t('sections.address.body'),
            value: t('sections.address.value'),
            href: null,
        },
    ];

    return (
        <LegalPageLayout backToHomeLabel={t('backToHome')}>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {t('title')}
            </h1>
            <p className="mt-6 text-white/55 leading-relaxed">{t('intro')}</p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {cards.map(({ key, icon: Icon, heading, body, value, href }) => (
                    <div
                        key={key}
                        className="rounded-xl border border-white/10 bg-white/2 p-6 flex flex-col gap-3"
                    >
                        <div className="flex items-center gap-2 text-primary">
                            <Icon className="h-5 w-5" />
                            <h2 className="text-base font-semibold text-white">{heading}</h2>
                        </div>
                        <p className="text-sm text-white/50 leading-relaxed">{body}</p>
                        {href ? (
                            <a href={href} className="text-primary hover:underline break-words">
                                {value}
                            </a>
                        ) : (
                            <p className="text-white/85 leading-relaxed">{value}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-10 flex items-start gap-3 rounded-xl border border-white/10 bg-white/2 p-6">
                <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                    <h2 className="text-base font-semibold text-white">
                        {t('sections.supportHours.heading')}
                    </h2>
                    <p className="mt-1 text-sm text-white/50 leading-relaxed">
                        {t('sections.supportHours.body')}
                    </p>
                </div>
            </div>
        </LegalPageLayout>
    );
}
