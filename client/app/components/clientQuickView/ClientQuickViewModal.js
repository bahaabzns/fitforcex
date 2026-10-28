"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { ExternalLink } from "lucide-react";
import { Modal } from "@heroui/react/modal";
import { PillPicker } from "./shared";
import OverviewTab from "./OverviewTab";
import NutritionTab from "./NutritionTab";
import TrainingTab from "./TrainingTab";
import FormsTab from "./FormsTab";
import TransactionsTab from "./TransactionsTab";
import ObservationsTab from "./ObservationsTab";

// Mirrors the client page's tab order. `path` is the full-page route for the same tab.
const TABS = [
    { id: "overview", Component: OverviewTab, path: "" },
    { id: "nutrition", Component: NutritionTab, path: "/nutrition" },
    { id: "training", Component: TrainingTab, path: "/training" },
    { id: "forms", Component: FormsTab, path: "/forms" },
    { id: "transactions", Component: TransactionsTab, path: "/transactions" },
    { id: "observations", Component: ObservationsTab, path: "/observations" },
];

/**
 * View-only look at a client without leaving the current page, as a bottom sheet
 * on every screen size. Keep it mounted and drive `open`: the slide-down on close
 * only plays if the modal isn't unmounted first. The dialog's contents unmount once
 * the exit finishes, so every open starts on Overview with fresh data.
 */
export default function ClientQuickViewModal({ open, onClose, clientId, clientName }) {
    // Black sheet in dark mode so the builder panels and cards read as distinct surfaces. Driven by
    // the resolved theme (like the app's other portaled popups) rather than relying on a `.dark`
    // ancestor, and `!` so it also beats the phone sheet background rule.
    const { resolvedTheme } = useTheme();
    const darkSheetClass = resolvedTheme === "dark" ? "bg-black!" : "";

    return (
        <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <Modal.Backdrop
                className="quick-view-backdrop"
                shouldCloseOnInteractOutside={(element) => !element.closest(".popover, .tooltip")}
            >
                <Modal.Container placement="bottom" className="quick-view-container p-0 sm:p-0 sm:w-full">
                    <Modal.Dialog className={`quick-view-sheet h-[92dvh] w-full max-w-none rounded-b-none rounded-t-3xl p-0 border-t border-border ${darkSheetClass}`}>
                        <QuickViewSheet clientId={clientId} clientName={clientName} />
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

// Tabs mount on first visit and stay mounted, so switching back doesn't refetch.
function QuickViewSheet({ clientId, clientName }) {
    const { workspaceSlug } = useParams();
    const t = useTranslations("clientQuickView");
    const tNav = useTranslations("nav");
    const tClients = useTranslations("clients");
    const [activeTabId, setActiveTabId] = useState("overview");
    const [visitedTabIds, setVisitedTabIds] = useState(() => new Set(["overview"]));

    const tabLabels = {
        overview: tClients("tabOverview"),
        nutrition: tNav("nutrition"),
        training: tNav("training"),
        forms: tNav("forms"),
        transactions: tNav("transactions"),
        observations: tNav("observations"),
    };

    function handleSelectTab(tabId) {
        setActiveTabId(tabId);
        setVisitedTabIds((prev) => (prev.has(tabId) ? prev : new Set(prev).add(tabId)));
    }

    const activeTab = TABS.find((tab) => tab.id === activeTabId);

    return (
        <>
            <div aria-hidden="true" className="max-md:hidden mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border" />
            <Modal.Header className="px-3 sm:px-5 pt-3 pb-2 shrink-0">
                <Modal.Heading className="truncate pe-10">{clientName || t("title")}</Modal.Heading>
                <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className="flex flex-col flex-1 min-h-0 gap-3 sm:gap-4 px-3 sm:px-5 pb-2">
                <div className="shrink-0 min-w-0">
                    <PillPicker
                        scrollable
                        ariaLabel={t("sections")}
                        options={TABS.map((tab) => ({ id: tab.id, label: tabLabels[tab.id] }))}
                        selectedId={activeTabId}
                        onSelect={handleSelectTab}
                    />
                </div>
                {TABS.filter((tab) => visitedTabIds.has(tab.id)).map(({ id, Component }) => (
                    <div key={id} hidden={id !== activeTabId} className="flex-1 min-h-0 flex flex-col">
                        <Component clientId={clientId} />
                    </div>
                ))}
            </Modal.Body>
            <Modal.Footer className="px-3 sm:px-5 py-3 shrink-0 border-t border-border">
                <Link
                    href={`/${workspaceSlug}/clients/${clientId}${activeTab.path}`}
                    className="ms-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ExternalLink size={14} />
                    {t("openFullPage")}
                </Link>
            </Modal.Footer>
        </>
    );
}
