'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";


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
                    <li><Link href="/databases" 
                        className={pathname.startsWith('/databases') ? 'sidebar-link-active' : 'sidebar-link'}>
                            Databases
                    </Link></li>
                </ul>
            </nav>
            <button onClick={handleLogout} className="btn-danger mt-auto mb-4 mx-4">
                Logout
            </button>
        </aside>
    );
}

