'use client';

import { useTranslations } from 'next-intl';
import LegalPageLayout from '../components/LegalPageLayout';

const SECTION_KEYS = ['subscription', 'cancellation', 'refunds', 'howToRequest', 'contactUs'];

export default function RefundPolicyContent() {
    const t = useTranslations('refundPolicy');

    return (
        <LegalPageLayout backToHomeLabel={t('backToHome')}>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {t('title')}
            </h1>
            <p className="mt-2 text-sm text-white/40">{t('effectiveDate')}</p>
            <p className="mt-6 text-white/55 leading-relaxed">{t('intro')}</p>

            <div className="mt-10 flex flex-col gap-10">
                {SECTION_KEYS.map((key) => (
                    <section key={key}>
                        <h2 className="text-xl font-semibold text-white">
                            {t(`sections.${key}.heading`)}
                        </h2>

                        {t.has(`sections.${key}.intro`) && (
                            <p className="mt-3 text-white/55 leading-relaxed">
                                {t(`sections.${key}.intro`)}
                            </p>
                        )}

                        {t.has(`sections.${key}.items`) && (
                            <ul className="mt-3 flex flex-col gap-2 ps-5 list-disc marker:text-white/30">
                                {t.raw(`sections.${key}.items`).map((item, index) => (
                                    <li key={index} className="text-white/55 leading-relaxed">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {t.has(`sections.${key}.body`) && (
                            <p className="mt-3 text-white/55 leading-relaxed">
                                {t(`sections.${key}.body`)}
                            </p>
                        )}

                        {t.has(`sections.${key}.email`) && (
                            <a
                                href={`mailto:${t(`sections.${key}.email`)}`}
                                className="mt-2 inline-block text-primary hover:underline"
                            >
                                {t(`sections.${key}.email`)}
                            </a>
                        )}
                    </section>
                ))}
            </div>
        </LegalPageLayout>
    );
}
