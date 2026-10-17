"use client";

import { useContentLang } from "./useContentLang";

const LANGS = [
    { value: "en", label: "EN" },
    { value: "ar", label: "AR" },
];

export default function ContentLangToggle({ className = "" }) {
    const [lang, setLang] = useContentLang();
    return (
        <div role="group" aria-label="Content language" dir="ltr" className={`inline-flex shrink-0 rounded-full border border-border p-0.5 ${className}`}>
            {LANGS.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    aria-pressed={lang === value}
                    onClick={() => setLang(value)}
                    className={`cursor-pointer text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                        lang === value ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
