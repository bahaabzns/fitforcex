'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, MessageCircle, Play, RotateCcw, Salad, ArrowLeftRight, Dumbbell, ClipboardList, X } from "lucide-react";
import { LANDING_SECTIONS } from "@/lib/landingConfig";
import { LpPhoneFrame } from "./LpFrames";
import LpShotImage from "./LpShotImage";

// The real client portal runs in an iframe named "ff-demo", fed from demo data (see lib/demo).
// Each task completes when the portal reports the matching action through postMessage.
const DEMO_SRC = "/portal/home";
const TASK_EVENTS = ["meal_checked", "food_swapped", "workout_logged", "message_sent", "form_submitted"];
const TASK_ICONS = [Salad, ArrowLeftRight, Dumbbell, MessageCircle, ClipboardList];
const DESKTOP_QUERY = "(min-width: 900px)";

function subscribeDesktop(callback) {
    const query = window.matchMedia(DESKTOP_QUERY);
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
}

function DemoFrame({ frameKey, locale, title, onLoaded }) {
    return (
        <iframe
            key={`${frameKey}-${locale}`}
            name="ff-demo"
            src={DEMO_SRC}
            title={title}
            className="lp-demo-iframe"
            onLoad={onLoaded}
        />
    );
}

export default function LpAppDemo() {
    const t = useTranslations("lp.phones");
    const locale = useLocale();
    const tasks = t.raw("tasks");
    const isDesktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => true);
    const [started, setStarted] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [done, setDone] = useState(() => new Set());
    const [runKey, setRunKey] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const dialogRef = useRef(null);

    // Task completion messages come only from our own demo frame.
    useEffect(() => {
        function onMessage(event) {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.source !== "ff-demo") return;
            const index = TASK_EVENTS.indexOf(data.event);
            if (index >= 0) setDone((current) => new Set(current).add(index));
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (dialogOpen && !dialog.open) dialog.showModal();
        if (!dialogOpen && dialog.open) dialog.close();
    }, [dialogOpen]);

    function start() {
        setStarted(true);
        setLoaded(false);
        if (!isDesktop) setDialogOpen(true);
    }

    function reset() {
        setDone(new Set());
        setLoaded(false);
        setRunKey((key) => key + 1);
    }

    const allDone = done.size === tasks.length;

    const taskList = (
        <ol className="lp-tasks">
            {tasks.map((task, index) => {
                const Icon = TASK_ICONS[index];
                const isDone = done.has(index);
                return (
                    <li key={task.task} className={`lp-glass lp-task ${isDone ? "is-done" : ""}`}>
                        <span className="lp-task__icon">{isDone ? <Check size={20} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}</span>
                        <span className="lp-task__copy">
                            <strong>{task.task}</strong>
                            <span>{task.benefit}</span>
                        </span>
                        <span className="sr-only">{isDone ? t("done") : t("todo")}</span>
                    </li>
                );
            })}
        </ol>
    );

    const facade = (
        <>
            <LpShotImage shotId="phoneNutrition" alt={t("posterAlt")} />
            <div className="lp-demo-facade">
                <button type="button" data-pixel="ViewContent" className="lp-btn lp-btn--primary lp-btn--lg" onClick={start}>
                    <Play size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    {t("try")}
                </button>
            </div>
        </>
    );

    return (
        <section id={LANDING_SECTIONS.app} className="lp-section lp-demo-sec" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <div className="lp-demo-app">
                    <div className="lp-demo-app__side">
                        <p className="lp-demo-app__note">{t("note")}</p>
                        <div className="lp-demo-app__progress" aria-live="polite">
                            <strong>{t("progress", { done: done.size, total: tasks.length })}</strong>
                            {started && (
                                <button type="button" className="lp-demo-app__reset" onClick={reset}>
                                    <RotateCcw size={16} aria-hidden="true" />
                                    {t("reset")}
                                </button>
                            )}
                        </div>
                        <div className="lp-demo-bar" role="presentation"><span style={{ width: `${(done.size / tasks.length) * 100}%` }} /></div>
                        {taskList}
                        {allDone && (
                            <Link href="/register" className="lp-closing lp-closing--cta" style={{ marginTop: 8 }}>{t("allDone")}</Link>
                        )}
                    </div>

                    <div className="lp-demo-app__phone">
                        <span className="lp-demo-ring lp-demo-ring--a" aria-hidden="true" />
                        <span className="lp-demo-ring lp-demo-ring--b" aria-hidden="true" />
                        <LpPhoneFrame className="lp-demo-phone">
                            {started && isDesktop ? (
                                <>
                                    <DemoFrame frameKey={runKey} locale={locale} title={t("frameTitle")} onLoaded={() => setLoaded(true)} />
                                    {!loaded && <div className="lp-demo-loading">{t("loading")}</div>}
                                </>
                            ) : facade}
                        </LpPhoneFrame>
                    </div>
                </div>
            </div>

            {/* Phones: the portal opens full screen, a phone inside a phone would be too small. */}
            <dialog ref={dialogRef} className="lp-appdialog" aria-label={t("frameTitle")} onClose={() => setDialogOpen(false)}>
                <div className="lp-appdialog__bar">
                    <strong>{t("progress", { done: done.size, total: tasks.length })}</strong>
                    <button type="button" className="lp-demo-app__reset" onClick={reset}>
                        <RotateCcw size={16} aria-hidden="true" />
                        {t("reset")}
                    </button>
                    <button type="button" className="lp-appdialog__close" onClick={() => setDialogOpen(false)} aria-label={t("close")}>
                        <X size={22} aria-hidden="true" />
                    </button>
                </div>
                {dialogOpen && started && !isDesktop && (
                    <>
                        <DemoFrame frameKey={runKey} locale={locale} title={t("frameTitle")} onLoaded={() => setLoaded(true)} />
                        {!loaded && <div className="lp-demo-loading">{t("loading")}</div>}
                    </>
                )}
            </dialog>
        </section>
    );
}
