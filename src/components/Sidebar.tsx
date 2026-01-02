"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Radio } from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();

    const routes = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/",
            active: pathname === "/",
        },
        {
            label: "Students",
            icon: Users,
            href: "/students",
            active: pathname === "/students",
        },
    ];

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-slate-900 text-white w-64">
            <div className="px-3 py-2 flex-1">
                <Link href="/" className="flex items-center pl-3 mb-14">
                    <Radio className="h-8 w-8 mr-4 text-emerald-500" />
                    <h1 className="text-2xl font-bold">RFID System</h1>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                route.active ? "text-white bg-white/10" : "text-zinc-400"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.active ? "text-emerald-500" : "text-zinc-400")} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
