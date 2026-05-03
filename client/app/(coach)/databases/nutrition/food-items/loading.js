export default function Loading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-36 bg-muted rounded-lg"></div>
        <div className="h-9 w-32 bg-muted rounded-lg"></div>
      </div>

      {/* Filter bar */}
      <div className="h-10 w-56 bg-muted rounded-lg mb-4"></div>

      {/* Table — food items has more columns */}
      <div className="rounded-lg border bg-card shadow-sm p-0 overflow-hidden">
        <div className="h-10 bg-muted/60 w-full mb-1"></div>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-12 mx-4 bg-muted rounded-lg mb-2"
            style={{ opacity: 1 - i * 0.08 }}
          ></div>
        ))}
      </div>
    </div>
  );
}
