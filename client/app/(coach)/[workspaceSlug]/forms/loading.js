export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-60px)] gap-0 p-3 animate-pulse overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Left panel */}
      <div className="flex-1 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-16 bg-muted rounded"></div>
          <div className="h-8 w-24 bg-muted rounded-lg"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-muted rounded-full"></div>
          <div className="h-6 w-16 bg-muted rounded-full"></div>
          <div className="h-6 w-10 bg-muted rounded-full"></div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-lg" style={{ opacity: 1 - i * 0.1 }}></div>
        ))}
      </div>

      {/* Divider */}
      <div className="w-2 shrink-0"></div>

      {/* Middle panel */}
      <div className="flex-1 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-3">
        <div className="h-7 w-48 bg-muted rounded-lg mb-1"></div>
        <div className="h-8 w-32 bg-muted rounded mb-3"></div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-lg" style={{ opacity: 1 - i * 0.12 }}></div>
        ))}
      </div>

      {/* Divider */}
      <div className="w-2 shrink-0"></div>

      {/* Right panel */}
      <div className="flex-1 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-4">
        <div className="h-4 w-32 bg-muted rounded mb-1"></div>
        <div className="h-10 bg-muted rounded-lg"></div>
        <div className="h-10 bg-muted rounded-lg"></div>
        <div className="h-6 w-24 bg-muted rounded mt-2"></div>
        <div className="h-24 bg-muted rounded-lg mt-auto"></div>
      </div>
    </div>
  );
}
