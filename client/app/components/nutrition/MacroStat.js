// A single macro/calorie column for nutrition rows: a small colored label on
// top with the value below. Shared by the meal cards (middle panel) and the
// food-item / alternative rows (right panel) so they read identically. Macro
// colors match MacrosDonut (carbs = primary, protein = orange, fat = amber).
//
// `strong` renders the value bold with no unit (used for the calorie column);
// otherwise the value shows with a muted "g" suffix (used for macros).
export default function MacroStat({ label, value, color = "text-muted-foreground", strong = false, width = "w-12" }) {
    return (
        <div className={`flex flex-col items-center gap-0.5 shrink-0 ${width}`}>
            <span className={`text-[11px] font-medium leading-none ${color}`}>{label}</span>
            {strong ? (
                <span className="text-sm font-bold text-foreground">{value}</span>
            ) : (
                <span className="text-xs text-muted-foreground">
                    <span className="text-foreground">{value}</span>g
                </span>
            )}
        </div>
    );
}
