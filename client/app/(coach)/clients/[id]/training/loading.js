export default function Loading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-muted rounded-lg"></div>
        <div className="h-9 w-36 bg-muted rounded-lg"></div>
      </div>

      {/* Plan list */}
      <div className="rounded-lg border bg-card shadow-sm p-0 overflow-hidden">
        <div className="h-10 bg-muted/60 w-full mb-1"></div>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-14 mx-4 bg-muted rounded-lg mb-2"
            style={{ opacity: 1 - i * 0.1 }}
          ></div>
        ))}
      </div>
    </div>
  );
}
