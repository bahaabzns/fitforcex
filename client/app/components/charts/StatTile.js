import './charts.css';

// The number is the chart: a label, one big value, and a plain-words note under it.
export default function StatTile({ label, value, note, icon: Icon, tone = 'default', onClick, isActive = false }) {
    const isInteractive = typeof onClick === 'function';
    const toneClasses = tone === 'attention' ? 'border-orange-300/70 bg-orange-500/5' : 'border-border bg-card';
    const Wrapper = isInteractive ? 'button' : 'div';

    return (
        <Wrapper
            {...(isInteractive ? { type: 'button', onClick, 'aria-pressed': isActive } : {})}
            className={`viz-root flex flex-col gap-1 rounded-xl border p-4 text-left ${toneClasses} ${isInteractive ? 'transition-colors hover:border-primary/50' : ''} ${isActive ? 'ring-2 ring-primary/40' : ''}`}
        >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {Icon && <Icon size={13} aria-hidden="true" />}
                {label}
            </span>
            <span className="text-3xl font-semibold leading-tight text-foreground">{value}</span>
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </Wrapper>
    );
}
