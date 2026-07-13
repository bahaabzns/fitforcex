'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '../components/LanguageSwitcher';

const SECTION_KEYS = [
    'informationWeCollect',
    'howWeUseYourInformation',
    'dataProtection',
    'thirdPartyServices',
    'yourRights',
    'contactUs',
];

export default function PrivacyPolicyContent() {
    const t = useTranslations('privacyPolicy');

    return (
        <main className="dark min-h-screen bg-[#080d1a] text-white flex flex-col">
            <header className="border-b border-white/10">
                <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/blue_white.png" alt="FitForce" className="h-7 w-auto" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-sm text-white/45 hover:text-white transition-colors">
                            {t('backToHome')}
                        </Link>
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-6 py-16 flex-1 w-full">
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
            </div>

            <footer className="border-t border-white/10">
                <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between gap-4">
                    <p className="text-xs text-white/25">
                        © {new Date().getFullYear()} FitForce. All rights reserved.
                    </p>
                    <Link href="/" className="text-sm text-white/45 hover:text-white transition-colors">
                        {t('backToHome')}
                    </Link>
                </div>
            </footer>
        </main>
    );
}
