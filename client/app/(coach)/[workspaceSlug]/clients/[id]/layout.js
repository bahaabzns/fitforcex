"use client";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { TabsRoot, TabListContainer, TabList, Tab, TabSeparator } from "@heroui/react/tabs";
import { LayoutDashboard, Apple, Dumbbell, ClipboardList, CreditCard } from "lucide-react";
import NutritionPage from "./nutrition/page";
import TrainingPage from "./training/page";

// Sliding white indicator that tracks the active tab position.
// Placed inside TabListContainer (position:relative) so it overlays the TabList background.
// Uses z-index layering: TabList bg → this indicator (z-0) → tab text/icons (z-1).
function SlidingIndicator({ selectedKey }) {
    const ref = useRef(null);
    const isFirst = useRef(true);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const animate = !isFirst.current;
        if (isFirst.current) isFirst.current = false;

        const tryPosition = (withAnimation) => {
            const container = el.closest('[data-slot="tabs-list-container"]');
            const activeTab = container?.querySelector('[data-slot="tabs-tab"][data-selected="true"]');
            if (!activeTab) return false;

            const cr = container.getBoundingClientRect();
            const tr = activeTab.getBoundingClientRect();

            el.style.transition = withAnimation
                ? "transform 250ms cubic-bezier(0.35, 0, 0.25, 1), width 250ms cubic-bezier(0.35, 0, 0.25, 1)"
                : "none";
            el.style.top    = `${tr.top - cr.top}px`;
            el.style.width  = `${tr.width}px`;
            el.style.height = `${tr.height}px`;
            el.style.transform = `translateX(${tr.left - cr.left}px)`;
            return true;
        };

        if (!tryPosition(animate)) {
            // react-aria's collection model hasn't finished its second render pass yet;
            // retry after the next frame when data-selected is in the DOM.
            const raf = requestAnimationFrame(() => tryPosition(false));
            return () => cancelAnimationFrame(raf);
        }
    }, [selectedKey]);

    return (
        <div
            ref={ref}
            aria-hidden="true"
            className="absolute left-0 bg-white rounded-3xl shadow-sm pointer-events-none"
            style={{ zIndex: 0 }}
        />
    );
}

export default function ClientLayout({ children }) {
    const { id, workspaceSlug } = useParams();
    const pathname = usePathname();
    const router = useRouter();

    const isNutrition = pathname === `/${workspaceSlug}/clients/${id}/nutrition`;
    const isTraining  = pathname === `/${workspaceSlug}/clients/${id}/training`;
    const isOther     = !isNutrition && !isTraining;

    // Lazy keep-alive: once a tab has been visited it stays mounted so state is preserved.
    // Updating during render (not in an effect) is the correct pattern for one-way ratchet state.
    const [nutriMounted, setNutriMounted] = useState(isNutrition);
    const [trainMounted, setTrainMounted] = useState(isTraining);
    if (isNutrition && !nutriMounted) setNutriMounted(true);
    if (isTraining  && !trainMounted) setTrainMounted(true);

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
            if (href && !href.startsWith(`/${workspaceSlug}/clients/${id}`)) {
                if (!window.confirm("You have unsaved changes. Leave without saving?")) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [isDirty, id, workspaceSlug]);

    const tabs = [
        { id: "overview",     name: "Overview",      icon: LayoutDashboard, href: `/${workspaceSlug}/clients/${id}` },
        { id: "nutrition",    name: "Nutrition",     icon: Apple,           href: `/${workspaceSlug}/clients/${id}/nutrition` },
        { id: "training",     name: "Training",      icon: Dumbbell,        href: `/${workspaceSlug}/clients/${id}/training` },
        { id: "forms",        name: "Forms",         icon: ClipboardList,   href: `/${workspaceSlug}/clients/${id}/forms` },
        { id: "transactions", name: "Transactions",  icon: CreditCard,      href: `/${workspaceSlug}/clients/${id}/transactions` },
    ];

    const selectedKey = tabs.find((t) => t.href === pathname)?.id ?? "overview";

    return (
        <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-lg font-semibold text-foreground">Clients</h2>
                <TabsRoot
                    variant="segment"
                    selectedKey={selectedKey}
                    onSelectionChange={(key) => {
                        const tab = tabs.find((t) => t.id === key);
                        if (tab) router.push(tab.href);
                    }}
                >
                    <TabListContainer>
                        <SlidingIndicator selectedKey={selectedKey} />
                        <TabList>
                            {tabs.map(({ id: tabId, name, icon: Icon }, i) => (
                                <Tab key={tabId} id={tabId} className="flex items-center gap-1.5">
                                    {i > 0 && <TabSeparator />}
                                    <Icon size={14} />
                                    {name}
                                </Tab>
                            ))}
                        </TabList>
                    </TabListContainer>
                </TabsRoot>
            </div>

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
