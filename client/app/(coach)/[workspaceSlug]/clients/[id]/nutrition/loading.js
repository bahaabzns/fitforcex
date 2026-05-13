export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-60px)] gap-0 animate-pulse overflow-hidden">
      {/* Left panel — plan list */}
      <div className="w-64 shrink-0 border-r border-border p-4 flex flex-col gap-3">
        <div className="h-6 w-32 bg-muted rounded mb-2"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-lg"></div>
        ))}
      </div>

      {/* Middle panel — cycles & meals */}
      <div className="flex-1 border-r border-border p-4 flex flex-col gap-3">
        <div className="h-6 w-40 bg-muted rounded mb-2"></div>
        {/* Cycle tabs */}
        <div className="flex gap-2 mb-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 w-24 bg-muted rounded-lg"></div>
          ))}
        </div>
        {/* Meal rows */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-lg"></div>
        ))}
      </div>

      {/* Right panel — meal items */}
      <div className="w-72 shrink-0 p-4 flex flex-col gap-3">
        <div className="h-6 w-36 bg-muted rounded mb-2"></div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}
