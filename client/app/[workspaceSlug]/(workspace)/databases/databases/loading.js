export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Heading */}
      <div className="h-7 w-36 bg-muted rounded-lg mb-8"></div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card shadow-sm p-6 flex flex-col gap-3">
            <div className="h-5 w-32 bg-muted rounded"></div>
            <div className="h-4 w-48 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
