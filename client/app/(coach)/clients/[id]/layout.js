"use client";
import { usePathname, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import NutritionPage from "./nutrition/page";
import TrainingPage from "./training/page";

export default function ClientLayout({ children }) {
    const { id } = useParams();
    const pathname = usePathname();

    const isNutrition = pathname === `/clients/${id}/nutrition`;
    const isTraining  = pathname === `/clients/${id}/training`;
    const isOther     = !isNutrition && !isTraining;

    // Lazy keep-alive: once a tab has been visited it stays mounted so state is preserved.
    const [nutriMounted, setNutriMounted] = useState(isNutrition);
    const [trainMounted, setTrainMounted] = useState(isTraining);
    useEffect(() => { if (isNutrition) setNutriMounted(true); }, [isNutrition]);
    useEffect(() => { if (isTraining)  setTrainMounted(true); }, [isTraining]);

    // Dirty state bubbled up from the always-mounted pages.
    const [nutritionDirty, setNutritionDirty] = useState(false);
    const [trainingDirty,  setTrainingDirty]  = useState(false);
    const isDirty = nutritionDirty || trainingDirty;

    // Intercept in-app link clicks that would navigate OUTSIDE the client area.
    // Tab-to-tab clicks (href starts with /clients/${id}) are allowed through freely.
    useEffect(() => {
        if (!isDirty) return;
        const handleClick = (e) => {
            const link = e.target.closest("a[href]");
            if (!link) return;
            const href = link.getAttribute("href");
            if (href && !href.startsWith(`/clients/${id}`)) {
                if (!window.confirm("You have unsaved changes. Leave without saving?")) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [isDirty, id]);

    const tabs = [
        { name: "Overview",      href: `/clients/${id}` },
        { name: "Nutrition",     href: `/clients/${id}/nutrition` },
        { name: "Training",      href: `/clients/${id}/training` },
        { name: "Forms",         href: `/clients/${id}/forms` },
        { name: "Transactions",  href: `/clients/${id}/transactions` },
    ];

    return (
        <div className="p-6 flex flex-col h-full">
            <nav className="border-b border-gray-200 mb-6 shrink-0">
                <ul className="flex gap-1 -mb-px">
                    {tabs.map((tab) => (
                        <li key={tab.name}>
                            <Link
                                href={tab.href}
                                className={
                                    pathname === tab.href
                                        ? "inline-block px-4 py-2 text-sm font-semibold text-primary border-b-2 border-primary"
                                        : "inline-block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-border"
                                }
                            >
                                {tab.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="flex-1 min-h-0">
                {/* Nutrition — mounted after first visit, hidden when not active */}
                {(isNutrition || nutriMounted) && (
                    <div className="h-full" style={{ display: isNutrition ? undefined : "none" }}>
                        <NutritionPage onDirtyChange={setNutritionDirty} />
                    </div>
                )}

                {/* Training — same keep-alive pattern */}
                {(isTraining || trainMounted) && (
                    <div className="h-full" style={{ display: isTraining ? undefined : "none" }}>
                        <TrainingPage onDirtyChange={setTrainingDirty} />
                    </div>
                )}

                {/* Overview / Forms — rendered via normal Next.js routing */}
                {isOther && children}
            </div>
        </div>
    );
}
