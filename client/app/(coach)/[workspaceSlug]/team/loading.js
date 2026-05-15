import { Skeleton } from "@heroui/react/skeleton";

export default function TeamLoading() {
    return (
        <div className="p-8 max-w-3xl">
            <Skeleton className="h-9 w-24 rounded-lg mb-6" />
            <div className="flex gap-4 mb-6">
                {[0,1,2].map(i => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}
            </div>
            <div className="flex flex-col gap-3">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
        </div>
    );
}
