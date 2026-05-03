export default function MacrosBadges({ calories, protein, carbs, fats }) {
    return (
        <div className="rounded-lg bg-card border border-border px-4 py-2.5 flex items-center gap-4">
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-foreground">{calories}</span>
                <span className="text-xs text-muted-foreground">kcal</span>
            </div>
            <div className="h-5 w-px bg-border shrink-0" />
            <div className="flex gap-4 flex-1">
                {[
                    { label: "C", value: carbs },
                    { label: "P", value: protein },
                    { label: "F", value: fats },
                ].map(({ label, value }) => (
                    <p key={label} className="text-sm flex items-baseline gap-0.5">
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                        <span className="text-xs text-muted-foreground">g</span>
                    </p>
                ))}
            </div>
        </div>
    );
}
