'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useState } from "react";


export default function Sidebar() {
    const pathname =usePathname();
    const router = useRouter();
    const handleLogout = async () => {
        try {
            await api.post('/api/auth/logout');
            router.push('/login');
        } catch (err) {
            console.log(err);
        }
    }
    const [dbOpen, setDbOpen] = useState(false);
    return (
        <aside className="sidebar">
            <h1 className="sidebar-title">FitForce X</h1>
            <nav>
                <ul className="px-2 py-4">
                    <li><Link href="/dashboard" 
                        className={pathname === '/dashboard' ? 'sidebar-link-active' : 'sidebar-link'}> 
                            Dashboard
                        </Link></li>
                    <li><Link href="/clients" 
                        className={pathname === '/clients' ? 'sidebar-link-active' : 'sidebar-link'}>
                            Clients
                    </Link></li>
                    <li>
                        <button onClick={() => setDbOpen(!dbOpen)} 
                        className={pathname.startsWith('/databases') ? 'sidebar-link-active' : 'sidebar-link'}>
                            Databases {dbOpen ? '▲' : '▼'}
                        </button>
                        {
                            dbOpen && (
                                <ul>
                                    <li><Link href="/databases/nutrition/food-items" 
                                    className={pathname === '/databases/nutrition/food-items' ? 'sidebar-link-active' : 'sidebar-link'}>Nutrition</Link></li>

                                    <li><Link href="/databases/training/exercise-library" 
                                    className={pathname === '/databases/training/exercise-library' ? 'sidebar-link-active' : 'sidebar-link'}>Training</Link></li>

                                </ul>
                            )
                        }
                    </li>
                </ul>
            </nav>
            <button onClick={handleLogout} className="btn-danger mt-auto mb-4 mx-4">
                Logout
            </button>
        </aside>
    );
}

