export default function Loading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-[#E5E5EA] rounded-lg"></div>
        <div className="h-9 w-36 bg-[#E5E5EA] rounded-lg"></div>
      </div>

      {/* Filter / search bar */}
      <div className="h-10 w-56 bg-[#E5E5EA] rounded-lg mb-4"></div>

      {/* Table card */}
      <div className="card p-0 overflow-hidden">
        {/* Table header */}
        <div className="h-10 bg-[#F0F0F5] w-full mb-1"></div>
        {/* Table rows */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-12 mx-4 bg-[#E5E5EA] rounded-lg mb-2"
            style={{ opacity: 1 - i * 0.08 }}
          ></div>
        ))}
      </div>
    </div>
  );
}
