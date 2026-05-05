export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Welcome heading */}
      <div className="h-8 w-64 bg-muted rounded-lg mb-8"></div>

      {/* Stat cards */}
      <div className="flex gap-4">
        <div className="rounded-lg border bg-card shadow-sm flex-1 p-6">
          <div className="h-4 w-24 bg-muted rounded mb-3"></div>
          <div className="h-8 w-12 bg-muted rounded"></div>
        </div>
        <div className="rounded-lg border bg-card shadow-sm flex-1 p-6">
          <div className="h-4 w-24 bg-muted rounded mb-3"></div>
          <div className="h-8 w-12 bg-muted rounded"></div>
        </div>
        <div className="rounded-lg border bg-card shadow-sm flex-1 p-6">
          <div className="h-4 w-24 bg-muted rounded mb-3"></div>
          <div className="h-8 w-12 bg-muted rounded"></div>
        </div>
      </div>
    </div>
  );
}
