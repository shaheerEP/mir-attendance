"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Radio, LogOut, Settings, School } from "lucide-react";
import { signOut } from "next-auth/react";

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
            label: "Classes",
            icon: School,
            href: "/classes",
            active: pathname === "/classes",
        },
        {
            label: "Settings",
            icon: Settings,
            href: "/settings",
            active: pathname === "/settings",
        },
    ];

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-slate-900 text-white w-64">
            <div className="px-3 py-2 flex-1">
                <Link href="/" className="flex items-center pl-3 mb-14">
                    <Radio className="h-8 w-8 mr-4 text-emerald-500" />
                    <h1 className="text-2xl font-bold">MIR Attendance</h1>
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
            <div className="px-3 py-2">
                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-sm group flex p-3 w-full justify-start font-medium cursor-pointer text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                >
                    <div className="flex items-center flex-1">
                        <LogOut className="h-5 w-5 mr-3 text-red-500" />
                        Log Out
                    </div>
                </button>
            </div>
        </div >
    );
}
