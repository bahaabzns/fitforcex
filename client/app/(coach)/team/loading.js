export default function TeamLoading() {
    return (
        <div className="p-8 max-w-3xl">
            <div className="h-9 w-24 rounded-lg bg-secondary animate-pulse mb-6" />
            <div className="flex gap-4 mb-6">
                {[1, 2, 3].map(i => <div key={i} className="h-9 w-24 rounded-lg bg-secondary animate-pulse" />)}
            </div>
            <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />)}
            </div>
        </div>
    );
}
