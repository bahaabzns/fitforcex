'use client';

import { useState } from "react";
import { Landmark, Smartphone } from "lucide-react";

const WALLET_LABEL_KEYS = {
    vodafone_cash: 'walletVodafoneCash',
    etisalat_cash: 'walletEtisalatCash',
    orange_cash:   'walletOrangeCash',
    we_pay:        'walletWePay',
};

// InstaPay is an instant bank transfer, mobile wallets are carrier-billed — two different
// icons on the one combined "InstaPay / Mobile Wallet" number makes clear it covers both;
// every other (carrier-specific) wallet row just gets the phone icon on its own.
function RowIcons({ instapay, wallet }) {
    return (
        <span className="flex items-center gap-1 text-muted-foreground shrink-0">
            {instapay && <Landmark className="h-4 w-4" aria-hidden="true" />}
            {wallet && <Smartphone className="h-4 w-4" aria-hidden="true" />}
        </span>
    );
}

// Same highlighted-card treatment as the reference-code box below it (border-primary/30 +
// bg-primary/5, large bold value) — the account number to pay is exactly as important as the
// reference code to mention, so it gets the same visual weight instead of a plain text row.
function CopyRow({ icons, label, value, onCopy, copied, copyLabel, copiedLabel }) {
    return (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {icons}
                    {label}
                </span>
                <p className="text-lg font-bold tracking-wide text-foreground truncate">{value}</p>
            </div>
            <button type="button" onClick={onCopy} className="text-xs font-medium text-primary hover:underline shrink-0">
                {copied ? copiedLabel : copyLabel}
            </button>
        </div>
    );
}

/**
 * Everything a coach needs to complete a manual InstaPay/wallet transfer and send proof —
 * the account numbers to send to, the reference code to mention, and a WhatsApp link with
 * the plan/amount/reference pre-filled. Shared by the register wizard's payment step and
 * settings/subscription's method picker so the two never drift.
 *
 * @param {{ amount: number, currency: string, instapayHandle: string|null,
 *   beneficiaryName: string|null, wallets: {provider: string, number: string}[],
 *   referenceCode: string, whatsappUrl: string }} info
 * @param {(key: string, values?: object) => string} t - translations from the "checkout" namespace
 */
export default function ManualPaymentPanel({ info, t }) {
    const [copied, setCopied] = useState(null);

    function copy(value, key) {
        navigator.clipboard?.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    }

    const hasAccounts = !!info.instapayHandle || info.wallets.length > 0;

    return (
        <div className="flex flex-col gap-4">
            {!hasAccounts && (
                // No INSTAPAY_HANDLE/WALLET_* env vars configured yet (see DEBT.md) — rather
                // than an empty box, tell the coach to get the account details over WhatsApp
                // instead of silently showing nothing to send money to.
                <p className="text-sm text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                    {t('noAccountsConfigured')}
                </p>
            )}

            {hasAccounts && (
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <p>1. {t('manualStep1', { amount: info.amount.toLocaleString(), currency: info.currency })}</p>
                    <p>2. {t('manualStep2')}</p>
                    <p>3. {t('manualStep3')}</p>
                </div>
            )}

            {hasAccounts && (
                // Rendered after the "send to any of the accounts below" instruction, per its
                // own wording — the highlighted account card(s) it's pointing at belong below it.
                <div className="flex flex-col gap-3">
                    {info.beneficiaryName && (
                        <div className="flex items-center justify-between text-sm px-1">
                            <span className="text-muted-foreground">{t('beneficiaryLabel')}</span>
                            <span className="font-medium text-foreground">{info.beneficiaryName}</span>
                        </div>
                    )}
                    {info.instapayHandle && (
                        <CopyRow
                            icons={<RowIcons instapay wallet />}
                            label={t('instapayLabel')} value={info.instapayHandle}
                            onCopy={() => copy(info.instapayHandle, 'instapay')} copied={copied === 'instapay'}
                            copyLabel={t('copy')} copiedLabel={t('copied')}
                        />
                    )}
                    {info.wallets.map((w) => (
                        <CopyRow
                            key={w.provider}
                            icons={<RowIcons wallet />}
                            label={t(WALLET_LABEL_KEYS[w.provider] ?? w.provider)} value={w.number}
                            onCopy={() => copy(w.number, w.provider)} copied={copied === w.provider}
                            copyLabel={t('copy')} copiedLabel={t('copied')}
                        />
                    ))}
                </div>
            )}

            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">{t('referenceCodeLabel')}</p>
                    <p className="text-lg font-bold tracking-widest text-foreground">{info.referenceCode}</p>
                </div>
                <button type="button" onClick={() => copy(info.referenceCode, 'ref')} className="text-xs font-medium text-primary hover:underline">
                    {copied === 'ref' ? t('copied') : t('copy')}
                </button>
            </div>

            <a
                href={info.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: "#25D366" }}
            >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.8a8.08 8.08 0 0 1 5.75 2.38 8.08 8.08 0 0 1 2.38 5.73c0 4.48-3.65 8.12-8.14 8.12a8.1 8.1 0 0 1-4.13-1.13l-.3-.17-3.12.82.83-3.04-.19-.31a8.06 8.06 0 0 1-1.24-4.32c0-4.48 3.65-8.08 8.15-8.08m-4.5 4.66c-.15 0-.4.06-.6.29-.21.23-.8.78-.8 1.9s.82 2.2.94 2.36c.11.15 1.6 2.5 3.95 3.4 1.94.76 2.34.6 2.76.57.42-.04 1.36-.55 1.55-1.09.19-.53.19-.99.13-1.09-.06-.09-.21-.15-.44-.27-.23-.11-1.36-.67-1.57-.75-.21-.08-.36-.11-.51.11-.15.23-.59.75-.72.9-.13.15-.27.17-.5.06-.23-.11-.96-.35-1.83-1.13-.68-.6-1.13-1.34-1.27-1.57-.13-.23-.01-.35.1-.47.11-.11.23-.27.35-.4.11-.14.15-.23.23-.38.08-.15.04-.29-.02-.4-.06-.11-.51-1.25-.71-1.71-.19-.45-.38-.39-.51-.39z" />
                </svg>
                {t('sendProofWhatsApp')}
            </a>
        </div>
    );
}
