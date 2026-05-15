import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="p-6">
      <div className="rounded-lg border bg-card shadow-sm p-6 mb-6 flex gap-6 items-start">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-7 w-48 rounded-lg mb-3" />
          <Skeleton className="h-4 w-64 rounded mb-2" />
          <Skeleton className="h-4 w-40 rounded mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="flex gap-3 mb-6">
        {[0,1,2].map(i => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}
      </div>
      <div className="rounded-lg border bg-card shadow-sm p-6">
        <Skeleton className="h-5 w-40 rounded mb-4" />
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg mb-3" />)}
      </div>
    </div>
  );
}
