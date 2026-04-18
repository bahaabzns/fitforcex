import Sidebar from "@/app/components/Sidebar";

export default function CoachLayout({ children }) {
    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-gray-50 text-gray-900">
                {children}
            </main>
        </div>
    );
}
