"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Smile } from "lucide-react";

// A small curated set rather than a full Unicode emoji library/picker package —
// covers the common WhatsApp-style reactions without pulling in a dependency.
const EMOJIS = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜",
    "🤪", "🤨", "🧐", "🤓", "😎", "🥳", "😏", "😒", "😞", "😔",
    "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠",
    "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "🤗", "🤔",
    "🤭", "🤫", "🙄", "😯", "😮", "😲", "🥱", "😴", "🤤", "😵",
    "🤢", "🤒", "🤠", "😈", "👍", "👎", "👏", "🙌", "🙏", "👋",
    "🤝", "💪", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
    "💔", "💯", "🔥", "✨", "🎉", "🎊", "✅", "❌", "⭐", "😷",
];

export default function EmojiPickerButton({ onSelect, className = "" }) {
    const t = useTranslations("messenger");
    const locale = useLocale();
    const isRtl = locale === "ar";
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const anchorRef = useRef(null);

    useLayoutEffect(() => {
        if (!open) return;
        const reposition = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            setPos({
                bottom: window.innerHeight - rect.top + 8,
                ...(isRtl ? { left: rect.left } : { right: window.innerWidth - rect.right }),
            });
        };
        reposition();
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        return () => {
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [open, isRtl]);

    return (
        <div ref={anchorRef} className={`relative shrink-0 ${className}`}>
            <button
                type="button"
                aria-label={t("emojiPickerLabel")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                onClick={() => setOpen(v => !v)}
            >
                <Smile size={18} />
            </button>

            {open && pos && createPortal(
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        style={{ position: "fixed", bottom: pos.bottom, left: pos.left, right: pos.right, zIndex: 50 }}
                        className="w-72 max-h-64 overflow-y-auto bg-card border border-border rounded-xl shadow-md p-2 grid grid-cols-8 gap-0.5"
                    >
                        {EMOJIS.map((emoji, i) => (
                            <button
                                key={i}
                                type="button"
                                className="flex items-center justify-center text-xl w-8 h-8 rounded-lg hover:bg-default transition-colors"
                                onClick={() => { onSelect(emoji); setOpen(false); }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
