export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 animate-pulse">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="h-7 w-36 bg-[#E5E5EA] rounded-lg"></div>
        <div className="h-8 w-20 bg-[#E5E5EA] rounded-lg"></div>
      </div>

      {/* Welcome + active plan card */}
      <div className="card p-6 mb-6">
        <div className="h-6 w-52 bg-[#E5E5EA] rounded-lg mb-4"></div>
        <div className="h-4 w-36 bg-[#E5E5EA] rounded mb-6"></div>

        {/* Macro summary row */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-4 w-16 bg-[#E5E5EA] rounded"></div>
              <div className="h-6 w-12 bg-[#E5E5EA] rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Meal list */}
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4">
            <div className="h-5 w-32 bg-[#E5E5EA] rounded mb-3"></div>
            {[...Array(2)].map((_, j) => (
              <div key={j} className="h-8 bg-[#E5E5EA] rounded mb-2"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
