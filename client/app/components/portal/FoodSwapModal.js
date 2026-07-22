"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { SearchField } from "@heroui/react/search-field";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";

/**
 * Client-facing food swap: search is backend-driven and every candidate
 * arrives with its equivalent grams + macros already computed server-side
 * (see clientPortalFoodSwap.controller.ts) — there is no client-side
 * quantity input or calculation anywhere in this component.
 */
export default function FoodSwapModal({ open, mealItemId, currentFood, onClose, onSwapped }) {
    const t = useTranslations("portal.dashboard.foodSwap");
    const [query, setQuery]               = useState("");
    const [alternatives, setAlternatives] = useState([]);
    const [loading, setLoading]           = useState(false);
    const [selected, setSelected]         = useState(null);
    const [confirming, setConfirming]     = useState(false);
    const [error, setError]               = useState("");
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!open) {
            setQuery("");
            setAlternatives([]);
            setSelected(null);
            setError("");
            setConfirming(false);
        }
    }, [open]);

    const search = useCallback(async (q) => {
        if (!mealItemId) return;
        setLoading(true);
        setError("");
        try {
            const res = await api.get(`/api/client-portal/meal-items/${mealItemId}/swap-search`, {
                params: { query: q || undefined },
            });
            setAlternatives(res.data.alternatives ?? []);
        } catch {
            setError(t("searchFailed"));
        } finally {
            setLoading(false);
        }
    }, [mealItemId, t]);

    useEffect(() => {
        if (!open) return;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => clearTimeout(debounceRef.current);
    }, [open, query, search]);

    const handleConfirm = async () => {
        if (!selected) return;
        setConfirming(true);
        setError("");
        try {
            const res = await api.post(`/api/client-portal/meal-items/${mealItemId}/swap`, {
                alternativeFoodId: selected.foodItemId,
            });
            onSwapped(res.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || t("swapFailed"));
        } finally {
            setConfirming(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={t("title", { name: currentFood?.name || "" })} wide>
            <div className="flex flex-col gap-3 p-2">
                <SearchField value={query} onChange={setQuery} variant="secondary" aria-label={t("searchPlaceholder")}>
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder={t("searchPlaceholder")} autoFocus />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>

                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                    {loading && (
                        <p className="text-sm text-muted-foreground text-center py-6">{t("searching")}</p>
                    )}
                    {!loading && alternatives.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>
                    )}
                    {!loading && alternatives.map((alt) => {
                        const isSelected = selected?.foodItemId === alt.foodItemId;
                        return (
                            <button
                                key={alt.foodItemId}
                                onClick={() => setSelected(alt)}
                                className={`text-start rounded-xl border p-3 transition-colors cursor-pointer ${
                                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-default"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span dir="auto" className="text-sm font-medium text-foreground">
                                        {alt.name || alt.nameAr}
                                    </span>
                                    {alt.foodCategory && (
                                        <Chip size="sm" variant="soft" color="default">
                                            <Chip.Label>{alt.foodCategory}</Chip.Label>
                                        </Chip>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1" dir="ltr">
                                    <span>{alt.calculatedAmount}{alt.servingUnit}</span>
                                    <span>{alt.calories} {t("kcal")}</span>
                                    <span>{t("proteinAbbr")} {alt.protein}g</span>
                                    <span>{t("carbsAbbr")} {alt.carbs}g</span>
                                    <span>{t("fatAbbr")} {alt.fat}g</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selected && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-1">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">{t("equivalentTo")}</span>
                        <span dir="auto" className="text-sm font-medium text-foreground">
                            {selected.name} — {selected.calculatedAmount}{selected.servingUnit}
                        </span>
                    </div>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}

                <ModalFooter>
                    <Button size="sm" variant="ghost" onPress={onClose}>{t("cancel")}</Button>
                    <Button size="sm" variant="primary" onPress={handleConfirm} isDisabled={!selected || confirming}>
                        {confirming ? t("confirming") : t("confirmSwap")}
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
