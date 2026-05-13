"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function NutritionDatabaseLayout({ children }) {
    const pathname = usePathname();
    const tabs = [
        { name: 'Food Items', href: `/${pathname.split('/')[2]}/databases/nutrition/food-items` },
        { name: 'Food Categories', href: `/${pathname.split('/')[2]}/databases/nutrition/food-categories` },
    ];

    return (
        <div className="p-6 flex flex-col h-full">
            <nav className="border-b border-gray-200 mb-6">
                <ul className="flex gap-1 -mb-px">
                    {tabs.map(tab => (
                        <li key={tab.name}>
                            <Link
                                href={tab.href}
                                className={
                                    pathname === tab.href
                                        ? "inline-block px-4 py-2 text-sm font-semibold text-primary border-b-2 border-primary"
                                        : "inline-block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-border"
                                }
                            >
                                {tab.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}
