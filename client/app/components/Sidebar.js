'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
    const pathname =usePathname();
    return (
        <aside className="w-64 h-screen bg-gray-900 text-white flex flex-col">
            <h1 className="text-xl font-bold text-white border-b border-gray-700 p-6">FitForce X</h1>
            <nav>
                <ul className="px-2 py-4">
                    <li><Link href="/dashboard" 
                        className={`block py-2 px-4 rounded ${pathname === '/dashboard' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`}> 
                            Dashboard
                        </Link></li>
                    <li><Link href="/clients" 
                        className={`block py-2 px-4 rounded ${pathname === '/clients' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`}>
                            Clients
                    </Link></li>
                    <li><Link href="/databases" 
                        className={`block py-2 px-4 rounded ${pathname.startsWith('/databases') ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`}>
                            Databases
                    </Link></li>
                </ul>
            </nav>
        </aside>
    );
}

