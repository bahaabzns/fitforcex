'use client';

import { ArrowDown } from 'lucide-react';
import ChartTooltip from './ChartTooltip';
import { useChartTooltip } from './useChartTooltip';

const BAR_THICKNESS_PX = 24;
// Funnel stages are ordered, so they take one ramp (light → dark) rather than separate hues.
const STAGE_COLORS = ['var(--viz-step-1)', 'var(--viz-step-2)', 'var(--viz-step-3)'];

function percentOf(part, whole) {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

// stages: [{ key, label, value, stepNote }] — the step note names what happened between two stages,
// e.g. "of visitors created an account".
export default function FunnelChart({ stages, emptyText = 'No visitors tracked yet.' }) {
    const { wrapperRef, tooltip, bind } = useChartTooltip();
    const top = stages[0]?.value ?? 0;

    if (top === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
    }

    return (
        <div ref={wrapperRef} className="relative flex flex-col">
            {stages.map((stage, index) => {
                const previous = index > 0 ? stages[index - 1].value : null;
                return (
                    <div key={stage.key}>
                        {previous !== null && (
                            <div className="flex items-center gap-1.5 py-2 pl-1 text-xs text-muted-foreground">
                                <ArrowDown size={12} aria-hidden="true" />
                                <span><strong className="font-semibold text-foreground">{percentOf(stage.value, previous)}%</strong> {stage.stepNote}</span>
                            </div>
                        )}
                        <div
                            tabIndex={0}
                            aria-label={`${stage.label}: ${stage.value}`}
                            className="viz-mark flex flex-col gap-1.5 rounded-md"
                            {...bind({ title: stage.label, rows: [
                                { label: 'coaches', value: stage.value, color: STAGE_COLORS[index] },
                                { label: `of all ${stages[0].label.toLowerCase()}`, value: `${percentOf(stage.value, top)}%` },
                            ] })}
                        >
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm text-foreground">{stage.label}</span>
                                <span className="text-sm font-semibold tabular-nums text-foreground">{stage.value}</span>
                            </div>
                            <div
                                className="viz-bar"
                                style={{
                                    height: BAR_THICKNESS_PX,
                                    width: `${(stage.value / top) * 100}%`,
                                    minWidth: stage.value > 0 ? 4 : 0,
                                    background: STAGE_COLORS[index % STAGE_COLORS.length],
                                    borderRadius: '0 4px 4px 0',
                                }}
                            />
                        </div>
                    </div>
                );
            })}
            <ChartTooltip tooltip={tooltip} />
        </div>
    );
}
