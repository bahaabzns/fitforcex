import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
    return (
        <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-7 w-40 rounded-lg" />
            {[0, 1, 2].map(i => (
                <div key={i} className="rounded-lg border bg-card shadow-sm p-4 flex items-center gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <Skeleton className="h-4 w-48 rounded" />
                        <Skeleton className="h-3 w-32 rounded" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            ))}
        </div>
    );
}
