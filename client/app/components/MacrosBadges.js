export default function MacrosBadges({ calories, protein, carbs, fats }) {
    return (
        <div className="flex gap-2 mb-4">
            <span className="flex-1 px-2 py-1 bg-amber-100 border border-amber-300 rounded text-center text-amber-800">{calories} kcal</span>
            <span className="flex-1 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-center text-blue-800"><span className="font-semibold">P: </span>{protein} g</span>
            <span className="flex-1 px-2 py-1 bg-lime-100 border border-lime-300 rounded text-center text-lime-800"><span className="font-semibold">C: </span>{carbs} g</span>
            <span className="flex-1 px-2 py-1 bg-purple-100 border border-purple-300 rounded text-center text-purple-800"><span className="font-semibold">F: </span>{fats} g</span>
        </div>
    )
}