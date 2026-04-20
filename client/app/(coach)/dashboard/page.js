'use client';
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";


export default function DashboardPage() {
    const [user, setUser] = useState(null);

    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            
            try {
                const res = await api.get('/api/dashboard');
                setUser(res.data);
            }

            catch (err) {
                console.log(err);
                router.push('/login');
            }
        }
        fetchUser();
    }, [router]);

    if(!user) {
        return (
            <p>Loading...</p>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold mb-6">Welcome, {user.fname}!</h1>
            <div className="card-wrapper">
                <div className="card">
                    <p className="card-title">Total Clients</p>
                    <p className="card-number">0</p>
                </div>
                <div className="card">
                    <p className="card-title">Total Plans</p>
                    <p className="card-number">0</p>
                </div>
            </div>
        </div>
    );
}
