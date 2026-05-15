import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-60px)] gap-0 overflow-hidden">
      <div className="w-64 shrink-0 border-r border-border p-4 flex flex-col gap-3">
        <Skeleton className="h-6 w-32 rounded mb-2" />
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
      </div>
      <div className="flex-1 border-r border-border p-4 flex flex-col gap-3">
        <Skeleton className="h-6 w-40 rounded mb-2" />
        <div className="flex gap-2 mb-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
        </div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
      <div className="w-72 shrink-0 p-4 flex flex-col gap-3">
        <Skeleton className="h-6 w-36 rounded mb-2" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    </div>
  );
}
