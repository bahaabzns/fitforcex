import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-56 rounded-lg mb-4" />
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none mb-1" />
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-12 mx-4 rounded-lg mb-2" style={{ opacity: 1 - i * 0.09 }} />
        ))}
      </div>
    </div>
  );
}
