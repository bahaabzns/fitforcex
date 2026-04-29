export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 w-36 bg-[#E5E5EA] rounded-lg mb-8"></div>
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card flex-1 p-6">
            <div className="h-4 w-24 bg-[#E5E5EA] rounded mb-3"></div>
            <div className="h-8 w-12 bg-[#E5E5EA] rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
