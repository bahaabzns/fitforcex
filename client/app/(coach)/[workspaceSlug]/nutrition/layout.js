export default function NutritionLayout({ children }) {
    return (
        <div className="p-6 flex flex-col h-full">
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}
