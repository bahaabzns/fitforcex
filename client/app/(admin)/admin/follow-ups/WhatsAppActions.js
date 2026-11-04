'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { whatsAppLink } from '@/lib/followUps';

const COPIED_FEEDBACK_MS = 1600;

const BUTTON_CLASSES = 'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors';

// Copy the number, or open a WhatsApp chat with it. Without a usable number both are disabled and
// say why, so the admin isn't left wondering whether the button is broken.
export default function WhatsAppActions({ coach }) {
    const [justCopied, setJustCopied] = useState(false);
    const hasNumber = !!coach.whatsappNumber;

    async function copyNumber(event) {
        event.stopPropagation();
        try {
            await navigator.clipboard.writeText(coach.phone);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            // Clipboard blocked (insecure origin / permissions) — the number is still shown to select by hand.
        }
    }

    if (!hasNumber) {
        return <span className="text-xs italic text-muted-foreground">No number</span>;
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">{coach.phone}</span>
            {coach.isPhoneSuspicious && <span className="text-[11px] text-orange-600">Check this number — it looks mistyped</span>}
            <div className="flex items-center gap-1.5">
                <button type="button" onClick={copyNumber} className={`${BUTTON_CLASSES} text-muted-foreground hover:bg-default hover:text-foreground`}>
                    {justCopied ? <Check size={12} /> : <Copy size={12} />}
                    {justCopied ? 'Copied' : 'Copy number'}
                </button>
                <a
                    href={whatsAppLink(coach.whatsappNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event => event.stopPropagation()}
                    className={`${BUTTON_CLASSES} border-green-300 bg-green-500/10 text-green-700 hover:bg-green-500/20`}
                >
                    <MessageCircle size={12} />
                    Open WhatsApp
                </a>
            </div>
        </div>
    );
}
