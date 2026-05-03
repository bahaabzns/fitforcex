export default function Loading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Client info card */}
      <div className="rounded-lg border bg-card shadow-sm p-6 mb-6 flex gap-6 items-start">
        {/* Avatar placeholder */}
        <div className="h-20 w-20 bg-muted rounded-full shrink-0"></div>
        <div className="flex-1">
          {/* Name */}
          <div className="h-7 w-48 bg-muted rounded-lg mb-3"></div>
          {/* Email */}
          <div className="h-4 w-64 bg-muted rounded mb-2"></div>
          {/* Phone */}
          <div className="h-4 w-40 bg-muted rounded mb-4"></div>
          {/* Action buttons */}
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-muted rounded-lg"></div>
            <div className="h-8 w-24 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-28 bg-muted rounded-lg"></div>
        ))}
      </div>

      {/* Content area */}
      <div className="rounded-lg border bg-card shadow-sm p-6">
        <div className="h-5 w-40 bg-muted rounded mb-4"></div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-lg mb-3"></div>
        ))}
      </div>
    </div>
  );
}
