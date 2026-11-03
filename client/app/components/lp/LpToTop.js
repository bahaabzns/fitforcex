'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER_PX = 400;

export default function LpToTop() {
    const t = useTranslations("lp.top");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    function goTop() {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }

    return (
        <button
            type="button"
            className={`lp-top lp-glass ${visible ? "is-visible" : ""}`}
            onClick={goTop}
            aria-label={t("label")}
            tabIndex={visible ? 0 : -1}
        >
            <ArrowUp size={22} aria-hidden="true" />
        </button>
    );
}
