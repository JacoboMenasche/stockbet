"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  BarChart2,
  Trophy,
  Medal,
  Wallet,
  LogOut,
} from "lucide-react";
import { formatCents } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string, section: string | null) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/markets?section=trending",
    label: "Trending",
    icon: <TrendingUp className="h-4 w-4" />,
    isActive: (p, s) => p === "/markets" && (s === "trending" || s === null),
  },
  {
    href: "/markets?section=all",
    label: "All Markets",
    icon: <BarChart2 className="h-4 w-4" />,
    isActive: (p, s) => p === "/markets" && s === "all",
  },
  {
    href: "/challenges",
    label: "Challenges",
    icon: <Trophy className="h-4 w-4" />,
    isActive: (p) => p.startsWith("/challenges"),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: <Medal className="h-4 w-4" />,
    isActive: (p) => p.startsWith("/leaderboard"),
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: <Wallet className="h-4 w-4" />,
    isActive: (p) => p.startsWith("/portfolio"),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/markets");
    router.refresh();
  }

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] flex-col z-40 border-r"
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--color-border-soft)" }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
          style={{
            background: "linear-gradient(180deg, rgba(148,228,132,0.95) 0%, rgba(110,200,95,0.95) 100%)",
          }}
        >
          <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--color-text-main)" }}>
          Ratio Markets
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
        <p className="text-[10px] font-medium uppercase tracking-widest px-2 pt-1 pb-2" style={{ color: "var(--color-text-soft)" }}>
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname, section);
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={
                active
                  ? {
                      backgroundColor: "rgba(148,228,132,0.12)",
                      color: "var(--color-yes)",
                    }
                  : {
                      color: "var(--color-text-muted)",
                    }
              }
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t space-y-2 shrink-0" style={{ borderColor: "var(--color-border-soft)" }}>
        {/* Balance */}
        {session && (
          <div
            className="rounded-lg px-3 py-2.5"
            style={{
              backgroundColor: "rgba(148,228,132,0.08)",
              border: "1px solid rgba(148,228,132,0.18)",
            }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--color-text-soft)" }}>
              Balance
            </p>
            <p className="text-sm font-semibold tabular" style={{ color: "var(--color-yes)" }}>
              {formatCents(session.user?.cashBalanceCents ?? 0)}
            </p>
          </div>
        )}

        {/* Theme toggle + sign out */}
        <div className="flex items-center justify-between px-1">
          <ThemeToggle />
          {session && (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--color-text-soft)" }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
