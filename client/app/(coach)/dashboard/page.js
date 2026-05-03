'use client';

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ClipboardList } from "lucide-react";

export default function DashboardPage() {
    const [user, setUser] = useState(null);
    const router = useRouter();

    useEffect(() => {
        api.get('/api/dashboard')
            .then(res => setUser(res.data))
            .catch(() => router.push('/login'));
    }, [router]);

    if (!user) {
        return (
            <div className="p-8">
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="flex gap-6 mt-6">
                    <Skeleton className="h-32 w-48" />
                    <Skeleton className="h-32 w-48" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-6 text-foreground">
                Welcome, {user.fname}!
            </h1>
            <div className="flex gap-6 mt-2 flex-wrap">
                <Card className="w-48">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" aria-hidden="true" />
                            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-primary">0</p>
                    </CardContent>
                </Card>

                <Card className="w-48">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <ClipboardList className="h-4 w-4" aria-hidden="true" />
                            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-primary">0</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
