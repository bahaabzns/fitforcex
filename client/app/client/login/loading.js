export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center animate-pulse">
      <div className="card p-8 w-full max-w-sm flex flex-col gap-4">
        <div className="h-7 w-40 bg-[#E5E5EA] rounded-lg mx-auto mb-2"></div>
        <div className="h-10 bg-[#E5E5EA] rounded-lg"></div>
        <div className="h-10 bg-[#E5E5EA] rounded-lg"></div>
        <div className="h-10 bg-[#E5E5EA] rounded-lg"></div>
      </div>
    </div>
  );
}
