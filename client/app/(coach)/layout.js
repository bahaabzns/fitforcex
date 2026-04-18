'use client';

import Sidebar from "@/app/components/Sidebar";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

export default function CoachLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await api.get('/api/auth/me');
                setLoading(false);
            } catch (err) {
                router.push('/login');
            }
        }

        checkAuth();
    }, [router]);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-gray-50 text-gray-900">
                {children}
            </main>
        </div>
    );
}
