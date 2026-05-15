import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <div className="rounded-lg border bg-card shadow-sm p-6 mb-6">
        <Skeleton className="h-6 w-52 rounded-lg mb-4" />
        <Skeleton className="h-4 w-36 rounded mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-6 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card shadow-sm p-4">
            <Skeleton className="h-5 w-32 rounded mb-3" />
            {[0,1].map(j => <Skeleton key={j} className="h-8 rounded mb-2" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
