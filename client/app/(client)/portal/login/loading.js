import { Skeleton } from "@heroui/react/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="rounded-lg border bg-card shadow-sm p-8 w-full max-w-sm flex flex-col gap-4">
        <Skeleton className="h-7 w-40 rounded-lg mx-auto mb-2" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    </div>
  );
}
