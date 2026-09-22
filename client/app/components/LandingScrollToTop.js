'use client';

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function LandingScrollToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        function onScroll() {
            setVisible(window.scrollY > 300);
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return (
        <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className={`fixed bottom-24 sm:bottom-28 inset-e-6 sm:inset-e-8 z-50 flex items-center justify-center rounded-full p-3 sm:p-4 text-white shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
                visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-10"
            }`}
            style={{
                background: "linear-gradient(90deg, var(--color-primary), color-mix(in oklch, var(--color-primary) 70%, black))",
                boxShadow: "0 10px 30px color-mix(in oklch, var(--color-primary) 30%, transparent)",
            }}
        >
            <ArrowUp className="h-5 w-5" />
        </button>
    );
}
