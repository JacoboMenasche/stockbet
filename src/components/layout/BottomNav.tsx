"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { TrendingUp, BarChart2, Trophy, Medal, Wallet } from "lucide-react";

interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string, section: string | null) => boolean;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    href: "/markets?section=trending",
    label: "Trending",
    icon: <TrendingUp className="h-5 w-5" />,
    isActive: (p, s) => p === "/markets" && (s === "trending" || s === null),
  },
  {
    href: "/markets?section=all",
    label: "Markets",
    icon: <BarChart2 className="h-5 w-5" />,
    isActive: (p, s) => p === "/markets" && s === "all",
  },
  {
    href: "/challenges",
    label: "Challenges",
    icon: <Trophy className="h-5 w-5" />,
    isActive: (p) => p.startsWith("/challenges"),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: <Medal className="h-5 w-5" />,
    isActive: (p) => p.startsWith("/leaderboard"),
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: <Wallet className="h-5 w-5" />,
    isActive: (p) => p.startsWith("/portfolio"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center border-t"
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname, section);
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
            style={{
              color: active ? "var(--color-yes)" : "var(--color-text-soft)",
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
