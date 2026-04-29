export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Welcome heading */}
      <div className="h-8 w-64 bg-[#E5E5EA] rounded-lg mb-8"></div>

      {/* Stat cards */}
      <div className="flex gap-4">
        <div className="card flex-1 p-6">
          <div className="h-4 w-24 bg-[#E5E5EA] rounded mb-3"></div>
          <div className="h-8 w-12 bg-[#E5E5EA] rounded"></div>
        </div>
        <div className="card flex-1 p-6">
          <div className="h-4 w-24 bg-[#E5E5EA] rounded mb-3"></div>
          <div className="h-8 w-12 bg-[#E5E5EA] rounded"></div>
        </div>
        <div className="card flex-1 p-6">
          <div className="h-4 w-24 bg-[#E5E5EA] rounded mb-3"></div>
          <div className="h-8 w-12 bg-[#E5E5EA] rounded"></div>
        </div>
      </div>
    </div>
  );
}
