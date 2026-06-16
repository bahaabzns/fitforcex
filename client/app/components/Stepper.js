'use client';

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stepper showing wizard progress, horizontal or vertical.
 *
 * States per step:
 *  - completed (index < current): solid primary circle with a check
 *  - active    (index === current): primary-outlined circle + number
 *  - upcoming  (index > current): muted circle + number
 *
 * @param {{ key: string, title: string, description?: string }[]} steps
 * @param {number} current - zero-based index of the active step
 * @param {"horizontal" | "vertical"} [orientation="horizontal"]
 * @param {(index: number) => void} [onStepClick] - if provided, completed steps become clickable
 */
export default function Stepper({ steps, current, orientation = "horizontal", onStepClick }) {
    const isVertical = orientation === "vertical";

    function Circle({ index, isCompleted, isActive, canNavigate }) {
        return (
            <button
                type="button"
                onClick={canNavigate ? () => onStepClick(index) : undefined}
                disabled={!canNavigate}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background transition-colors",
                    isCompleted && "border-2 border-primary bg-primary text-primary-foreground",
                    isActive && "border-2 border-primary text-primary",
                    !isCompleted && !isActive && "border border-border text-muted-foreground",
                    canNavigate && "cursor-pointer hover:opacity-90",
                )}
            >
                {isCompleted ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                )}
            </button>
        );
    }

    function Labels({ step, isActive, isCompleted }) {
        return (
            <>
                <span
                    className={cn(
                        "text-sm font-semibold leading-tight",
                        isActive || isCompleted ? "text-foreground" : "text-muted-foreground",
                    )}
                >
                    {step.title}
                </span>
                {step.description && (
                    <span className="text-xs text-muted-foreground leading-tight">
                        {step.description}
                    </span>
                )}
            </>
        );
    }

    if (isVertical) {
        return (
            <div className="flex flex-col">
                {steps.map((step, index) => {
                    const isCompleted = index < current;
                    const isActive = index === current;
                    const canNavigate = isCompleted && typeof onStepClick === "function";
                    const isLast = index === steps.length - 1;

                    return (
                        <div key={step.key} className="flex gap-3">
                            {/* circle + vertical connector */}
                            <div className="flex flex-col items-center self-stretch">
                                <Circle index={index} isCompleted={isCompleted} isActive={isActive} canNavigate={canNavigate} />
                                {!isLast && (
                                    <div
                                        className={cn(
                                            "my-1 w-0.5 grow rounded-full",
                                            isCompleted ? "bg-primary" : "bg-border",
                                        )}
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                            {/* labels */}
                            <div className={cn("flex flex-col gap-0.5 pt-1.5", !isLast && "pb-6")}>
                                <Labels step={step} isActive={isActive} isCompleted={isCompleted} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex items-start w-full">
            {steps.map((step, index) => {
                const isCompleted = index < current;
                const isActive = index === current;
                const canNavigate = isCompleted && typeof onStepClick === "function";

                return (
                    <Fragment key={step.key}>
                        <div className="relative flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-lg p-3">
                            {/* connector to the next step — sits behind the circles */}
                            {index < steps.length - 1 && (
                                <div
                                    className={cn(
                                        "absolute top-8 start-8 h-0.5 w-full -translate-y-1/2 rounded-full",
                                        isCompleted ? "bg-primary" : "bg-border",
                                    )}
                                    aria-hidden="true"
                                />
                            )}
                            <Circle index={index} isCompleted={isCompleted} isActive={isActive} canNavigate={canNavigate} />
                            <Labels step={step} isActive={isActive} isCompleted={isCompleted} />
                        </div>
                    </Fragment>
                );
            })}
        </div>
    );
}
