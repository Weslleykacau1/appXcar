
"use client";

import { cn } from "@/lib/utils";
import { Home, History, User, Car } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface BottomNavBarProps {
    role: "passenger" | "driver";
}

export function BottomNavBar({ role }: BottomNavBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const menuItems = role === 'passenger' ? [
        { href: '/passenger/request-ride', label: 'Corridas', icon: Car, id: 'home' },
        { href: '/passenger/profile?showHistory=true', label: 'Viagens', icon: History, id: 'history' },
        { href: '/passenger/profile', label: 'Você', icon: User, id: 'account' },
    ] : [
        { href: '/driver', label: 'Início', icon: Home, id: 'home' },
        { href: '/driver/statistics', label: 'Viagens', icon: History, id: 'history' },
        { href: '/driver/profile', label: 'Conta', icon: User, id: 'account' },
    ];
    
    const isItemActive = (item: typeof menuItems[0]) => {
        const hasShowHistory = searchParams.get('showHistory') === 'true';

        if (item.id === 'history') {
             if (role === 'passenger') {
                return pathname === '/passenger/profile' && hasShowHistory;
            }
            return pathname === item.href;
        }

        if (item.id === 'account') {
             if (role === 'passenger') {
                return pathname === '/passenger/profile' && !hasShowHistory;
            }
            return pathname === item.href;
        }

        return pathname === item.href;
    };


    return (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/80 backdrop-blur-sm shadow-[0_-1px_4px_rgba(0,0,0,0.05)]">
            <div className="container mx-auto flex h-16 max-w-md items-center justify-around px-2 pb-safe">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = isItemActive(item);
                    return (
                         <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 text-xs font-medium w-20 h-full rounded-lg transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    )
}
