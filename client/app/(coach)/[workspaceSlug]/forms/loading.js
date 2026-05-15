import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-60px)] gap-0 p-3 overflow-hidden" style={{ background: "var(--background)" }}>
      <div className="flex-1 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>

      <div className="w-2 shrink-0" />

      <div className="flex-1 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-3">
        <Skeleton className="h-7 w-48 rounded-lg mb-1" />
        <Skeleton className="h-8 w-32 rounded mb-3" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>

      <div className="w-2 shrink-0" />

      <div className="flex-1 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-4">
        <Skeleton className="h-4 w-32 rounded mb-1" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-6 w-24 rounded mt-2" />
        <Skeleton className="h-24 rounded-lg mt-auto" />
      </div>
    </div>
  );
}
