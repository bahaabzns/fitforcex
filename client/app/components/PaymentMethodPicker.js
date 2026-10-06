'use client';

// Card / mobile wallet / Fawry / manual-transfer chooser shared by the checkout wizard
// (register) and the subscription page. Card, wallet and Fawry go through the payment
// gateway (create-invoice with that paymentMethod); the wallet one also needs the coach's
// wallet phone number. Translation keys exist in both the "checkout" and "subscriptionPlans"
// namespaces, so the caller just passes its own `t`.

export const PAYMENT_METHODS = ['card', 'wallet', 'fawry', 'manual'];

const METHOD_LABEL_KEYS = {
    card:   'payWithCard',
    wallet: 'payWithWallet',
    fawry:  'payWithFawry',
    manual: 'payManually',
};

export function isWalletPhoneValid(walletPhone) {
    return /^\+?\d{10,15}$/.test(walletPhone.trim());
}

export default function PaymentMethodPicker({ method, onMethodChange, walletPhone, onWalletPhoneChange, t }) {
    return (
        <div className="flex flex-col gap-2">
            {PAYMENT_METHODS.map((key) => {
                const selected = method === key;
                return (
                    <label
                        key={key}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/40'}`}
                    >
                        <input type="radio" name="payment-method" checked={selected} onChange={() => onMethodChange(key)} />
                        <span className="flex flex-col items-start gap-0.5">
                            <span className="text-sm text-foreground font-medium">{t(METHOD_LABEL_KEYS[key])}</span>
                            {key === 'manual' && <span className="text-xs text-muted-foreground">{t('payManuallyHint')}</span>}
                        </span>
                    </label>
                );
            })}

            {method === 'wallet' && (
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="wallet-phone">{t('walletPhoneLabel')}</label>
                    <input
                        id="wallet-phone"
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        value={walletPhone}
                        onChange={(e) => onWalletPhoneChange(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                </div>
            )}
        </div>
    );
}
