export default function MacrosBadges({ calories, protein, carbs, fats }) {
    return (
        <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex items-center gap-4">
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-800">{calories}</span>
                <span className="text-sm text-gray-400">kcal</span>
            </div>
            <div className="h-6 w-px bg-gray-200 shrink-0" />
            <div className="flex gap-4 flex-1">
                {[
                    { label: "C", value: carbs,   color: "text-teal-600" },
                    { label: "P", value: protein, color: "text-red-500" },
                    { label: "F", value: fats,    color: "text-yellow-600" },
                ].map(({ label, value, color }) => (
                    <p key={label} className="text-sm font-semibold text-gray-800 flex items-baseline gap-1">
                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                        {value}<span className="text-xs text-gray-400 font-normal">g</span>
                    </p>
                ))}
            </div>
        </div>
    );
}