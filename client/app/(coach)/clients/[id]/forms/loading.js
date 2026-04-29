export default function Loading() {
    return (
        <div className="p-6 flex flex-col gap-3 animate-pulse">
            <div className="h-7 w-40 bg-[#E5E5EA] rounded-lg"></div>
            {[1, 2, 3].map(i => (
                <div key={i} className="card flex items-center gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="h-4 w-48 bg-[#E5E5EA] rounded"></div>
                        <div className="h-3 w-32 bg-[#E5E5EA] rounded"></div>
                    </div>
                    <div className="h-6 w-20 bg-[#E5E5EA] rounded-full"></div>
                </div>
            ))}
        </div>
    );
}
