
export default function FoodItemsModal({ foodItems, foodSearchQuery, onSearchChange, onClose, onSelectItem }) {

    return (
        <div
                className={`fixed inset-0 flex items-center justify-center bg-black/30 z-50`}
                onClick={onClose}
            >
            <div
                className="card px-6 py-4 w-96 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4">Search Food Items</h2>
                <input
                type="text"
                className="input-field mb-4"
                placeholder="Search for food..."
                value={foodSearchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
                />
                <div className="flex-1 overflow-y-auto min-h-0 mt-2">
                {foodItems
                    .filter((fi) =>
                    fi.name.toLowerCase().includes(foodSearchQuery.toLowerCase()),
                    )
                    .map((fi) => (
                    <div
                        key={fi.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => onSelectItem(fi)}
                    >
                        <p className="font-medium">{fi.name}</p>
                        <p className="text-sm text-gray-500">
                        {fi.calories_per_serving} kcal / {fi.serving_size} {fi.serving_unit}
                        </p>
                    </div>
                    ))}
                </div>
            </div>
            </div>
    )
}