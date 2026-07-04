"use client";

import { Tooltip } from "@heroui/react/tooltip";

export default function SettingsPlaceholderRow({ icon: Icon, label, description, comingSoonLabel }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0">
            <div className="flex items-center gap-3">
                {Icon && <Icon size={16} className="text-muted-foreground shrink-0" />}
                <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
            </div>
            <Tooltip>
                <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-secondary/50 cursor-default">
                    {comingSoonLabel}
                </span>
                <Tooltip.Content>{comingSoonLabel}</Tooltip.Content>
            </Tooltip>
        </div>
    );
}
