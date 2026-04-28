export default function MacrosBadges({ calories, protein, carbs, fats }) {
    return (
        <div className="rounded-xl bg-white border border-gray-200 px-4 py-2.5 flex items-center gap-4">
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-gray-900">{calories}</span>
                <span className="text-xs text-gray-400">kcal</span>
            </div>
            <div className="h-5 w-px bg-gray-200 shrink-0" />
            <div className="flex gap-4 flex-1">
                {[
                    { label: "C", value: carbs },
                    { label: "P", value: protein },
                    { label: "F", value: fats },
                ].map(({ label, value }) => (
                    <p key={label} className="text-sm text-gray-500 flex items-baseline gap-0.5">
                        <span className="text-xs font-medium text-gray-400">{label}</span>
                        <span className="font-medium text-gray-700">{value}</span>
                        <span className="text-xs text-gray-400">g</span>
                    </p>
                ))}
            </div>
        </div>
    );
}