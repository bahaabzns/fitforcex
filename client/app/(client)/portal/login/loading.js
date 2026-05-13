export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center animate-pulse">
      <div className="rounded-lg border bg-card shadow-sm p-8 w-full max-w-sm flex flex-col gap-4">
        <div className="h-7 w-40 bg-muted rounded-lg mx-auto mb-2"></div>
        <div className="h-10 bg-muted rounded-lg"></div>
        <div className="h-10 bg-muted rounded-lg"></div>
        <div className="h-10 bg-muted rounded-lg"></div>
      </div>
    </div>
  );
}
