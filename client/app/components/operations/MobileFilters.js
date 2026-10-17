"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Drawer } from "@heroui/react/drawer";

// The ids a filter currently has chosen, as a list whether it is single or multiple choice.
const chosenIdsOf = (filter) => (filter.multiple ? filter.value : filter.value === null || filter.value === undefined ? [] : [filter.value]);

// The chart filters on a phone: one equal-width button per filter that shows its current choice; tapping it
// slides a bottom sheet up with the options. Single choice, picking an option applies it and closes the sheet.
//
//   filters  [{ key, label, title, anyLabel, options: [{ id, label }], value, onChange }]
//            `value` is the chosen option id or null (no filter); `anyLabel` names the "no filter" choice.
//            With `multiple`, `value` is a list of ids (empty = no filter), the sheet stays open while ticking, and
//            "Done" closes it; the "no filter" row clears the list.
export default function MobileFilters({ filters, doneLabel }) {
    const [openKey, setOpenKey] = useState(null);
    const openFilter = filters.find((filter) => filter.key === openKey) ?? null;

    // Single choice applies and closes; multiple choice toggles the option and stays open.
    function pick(filter, id) {
        if (!filter.multiple) {
            filter.onChange(id);
            setOpenKey(null);
        } else if (id === null) {
            filter.onChange([]);
        } else {
            filter.onChange(filter.value.includes(id) ? filter.value.filter((existing) => existing !== id) : [...filter.value, id]);
        }
    }

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                {filters.map((filter) => {
                    const chosenIds = chosenIdsOf(filter);
                    const chosenOptions = filter.options.filter((option) => chosenIds.includes(option.id));
                    const chosen = chosenOptions.length > 0;
                    // Several picked: name the first and count the rest.
                    const chosenText = chosenOptions.length > 1 ? `${chosenOptions[0].label} +${chosenOptions.length - 1}` : chosenOptions[0]?.label;
                    return (
                        <button
                            key={filter.key}
                            type="button"
                            onClick={() => setOpenKey(filter.key)}
                            className={`flex min-w-0 items-center justify-between gap-1 rounded-xl px-3 py-2 text-start cursor-pointer transition-colors border-0 ${
                                chosen ? "bg-accent/15 text-foreground" : "bg-default/60 text-foreground"
                            }`}
                        >
                            <span className="min-w-0">
                                <span className="block text-[11px] leading-tight text-muted-foreground">{filter.label}</span>
                                <span className="block truncate text-sm font-medium leading-tight">{chosen ? chosenText : filter.anyLabel}</span>
                            </span>
                            <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                    );
                })}
            </div>

            <Drawer isOpen={openFilter !== null} onOpenChange={(isOpen) => { if (!isOpen) setOpenKey(null); }}>
                <Drawer.Backdrop isDismissable>
                    <Drawer.Content placement="bottom">
                        <Drawer.Dialog className="flex flex-col bg-background rounded-t-2xl max-h-[80vh]">
                            <Drawer.Handle />
                            <Drawer.Header className="px-5 pt-2 pb-3">
                                <Drawer.Heading className="text-base font-semibold text-foreground">{openFilter?.title}</Drawer.Heading>
                            </Drawer.Header>
                            <Drawer.Body className="flex flex-col gap-1 overflow-y-auto px-3 pb-6">
                                {openFilter && [{ id: null, label: openFilter.anyLabel }, ...openFilter.options].map((option) => {
                                    const chosenIds = chosenIdsOf(openFilter);
                                    const isChosen = option.id === null ? chosenIds.length === 0 : chosenIds.includes(option.id);
                                    return (
                                        <button
                                            key={option.id ?? "__any__"}
                                            type="button"
                                            onClick={() => pick(openFilter, option.id)}
                                            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-start text-sm cursor-pointer border-0 transition-colors ${
                                                isChosen ? "bg-accent/15 text-foreground font-semibold" : "bg-transparent text-foreground hover:bg-default/60"
                                            }`}
                                        >
                                            <span className="min-w-0 wrap-break-word">{option.label}</span>
                                            {isChosen && <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </Drawer.Body>
                            {openFilter?.multiple && (
                                <Drawer.Footer className="border-t border-border px-4 py-3">
                                    <Button variant="primary" className="w-full" onClick={() => setOpenKey(null)}>{doneLabel}</Button>
                                </Drawer.Footer>
                            )}
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>
        </>
    );
}
