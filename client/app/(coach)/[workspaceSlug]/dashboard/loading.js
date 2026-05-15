import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="p-8">
      <Skeleton className="h-8 w-64 rounded-lg mb-8" />
      <div className="flex gap-4">
        {[0,1,2].map(i => (
          <div key={i} className="rounded-lg border bg-card shadow-sm flex-1 p-6">
            <Skeleton className="h-4 w-24 rounded mb-3" />
            <Skeleton className="h-8 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
