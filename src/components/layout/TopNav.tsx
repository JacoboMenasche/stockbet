"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 flex h-14 items-center border-b px-6"
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <Link href="/markets" className="flex items-center gap-2 mr-8 shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: "var(--color-yes)" }}
        >
          <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">
          Ratio Markets
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1 flex-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                isActive
                  ? "text-white font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
              style={
                isActive
                  ? { backgroundColor: "rgba(255,255,255,0.07)" }
                  : undefined
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Account balance pill */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm tabular"
        style={{ backgroundColor: "rgba(0,194,168,0.1)", color: "var(--color-yes)" }}
      >
        <Wallet className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">$1,000.00</span>
      </div>
    </header>
  );
}
