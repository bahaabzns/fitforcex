"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { PartyPopper, Star } from "lucide-react";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";
import api from "@/lib/axios";
import { formatDuration } from "@/utils/workout";
import { getLocalizedField } from "@/utils/localization";
import { playSuccessChime } from "@/utils/sound";
import { usePageTitle } from "@/hooks/usePageTitle";

// Shown once, right after a client finishes a Training Mode session — replaces
// the old silent redirect straight to history. The rating+text section below
// is deliberately built from scratch rather than reusing the shared
// PromptCard/InsightBanner components: those are styled as a dismissible
// "quick question" card, and this is meant to read as part of the
// celebration itself, not a survey bolted onto it.
export default function SessionCompletePage() {
    const t = useTranslations("portal.training");
    usePageTitle(t("sessionCompleteTitle"));
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();

    const dayName  = searchParams.get("dayName") || "";
    const duration = searchParams.get("duration");
    const volume   = searchParams.get("volume");
    const sets     = searchParams.get("sets");

    const [phrase] = useState(() => {
        const phrases = t.raw("motivationalPhrases");
        return phrases[Math.floor(Math.random() * phrases.length)];
    });

    const [prompt, setPrompt]             = useState(null);
    const [rating, setRating]             = useState(0);
    const [hoverRating, setHoverRating]   = useState(0);
    const [feedbackText, setFeedbackText] = useState("");

    useEffect(() => {
        playSuccessChime();
    }, []);

    useEffect(() => {
        api.get("/api/client-portal/prompts/post-session")
            .then(({ data }) => setPrompt(data ?? null))
            .catch(() => setPrompt(null));
    }, []);

    // Feedback is a nice-to-have, not the critical path — fire it and leave
    // immediately rather than making the client wait on a confirmation screen.
    function sendFeedback() {
        if (!prompt || rating === 0) return;
        api.post(`/api/client-portal/prompts/${prompt.id}/respond`, {
            ratingValue: rating,
            textValue: feedbackText.trim() || undefined,
        }).catch(() => {});
        router.push("/portal/training");
    }

    const scaleMax = prompt?.scale_max ?? 5;
    const stars = Array.from({ length: scaleMax }, (_, i) => i + 1);
    const displayRating = hoverRating || rating;

    return (
        <div className="max-w-md mx-auto px-6 min-h-[calc(100vh-3.5rem-4rem-env(safe-area-inset-bottom))] flex flex-col justify-center items-center text-center gap-6">
            <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center">
                    <PartyPopper className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{t("sessionCompleteTitle")}</h1>
                {dayName && <p className="text-sm font-medium text-muted-foreground">{dayName}</p>}
                <p className="text-sm text-muted-foreground max-w-xs">{phrase}</p>
            </div>

            {(duration || volume || sets) && (
                <div className="flex items-center gap-6 text-sm text-foreground tabular-nums">
                    {duration && (
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold">{formatDuration(Number(duration))}</span>
                            <span className="text-[11px] text-muted-foreground">{t("workout")}</span>
                        </div>
                    )}
                    {volume && (
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold">{volume} {t("volumeUnit")}</span>
                            <span className="text-[11px] text-muted-foreground">{t("metricVolume")}</span>
                        </div>
                    )}
                    {sets && (
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold">{sets}</span>
                            <span className="text-[11px] text-muted-foreground">{t("setsShort")}</span>
                        </div>
                    )}
                </div>
            )}

            {prompt && (
                <div className="w-full flex flex-col items-center gap-3 pt-5 border-t border-border">
                    <p dir="auto" className="text-base font-semibold text-foreground">
                        {getLocalizedField(prompt, "question", locale)}
                    </p>
                    <div className="flex items-center gap-1">
                        {stars.map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setRating(n)}
                                onMouseEnter={() => setHoverRating(n)}
                                onMouseLeave={() => setHoverRating(0)}
                                aria-label={String(n)}
                                className="p-1 cursor-pointer"
                            >
                                <Star
                                    className={`w-7 h-7 transition-colors ${
                                        displayRating >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                    }`}
                                />
                            </button>
                        ))}
                    </div>
                    <TextField value={feedbackText} onChange={setFeedbackText} aria-label={t("feedbackPlaceholder")} variant="secondary" fullWidth>
                        <TextArea placeholder={t("feedbackPlaceholder")} dir={locale === "ar" ? "rtl" : "ltr"} rows={3} className="resize-none" />
                    </TextField>
                    <div className="w-full flex flex-col gap-2">
                        <Button type="button" variant="primary" fullWidth onClick={sendFeedback} isDisabled={rating === 0}>
                            {t("sendFeedback")}
                        </Button>
                        <Button type="button" variant="ghost" fullWidth onClick={() => router.push("/portal/training")}>
                            {t("skipFeedback")}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
