export default function MacrosBadges({ calories, protein, carbs, fats }) {
    return (
        <div className="flex gap-2 mb-4">
            <span className="flex-1 px-2 py-1 bg-blue-100 border border-blue-200 rounded text-center">{calories} kcal</span>
            <span className="flex-1 px-2 py-1 bg-blue-100 border border-blue-200 rounded text-center"><span className="font-semibold">P: </span>{protein} g</span>
            <span className="flex-1 px-2 py-1 bg-blue-100 border border-blue-200 rounded text-center"><span className="font-semibold">C: </span>{carbs} g</span>
            <span className="flex-1 px-2 py-1 bg-blue-100 border border-blue-200 rounded text-center"><span className="font-semibold">F: </span>{fats} g</span>
        </div>
    )
}