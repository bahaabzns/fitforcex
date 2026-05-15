import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none mb-1" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 mx-4 rounded-lg mb-2" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
