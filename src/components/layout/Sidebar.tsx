"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  BarChart2,
  Trophy,
  Medal,
  Wallet,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { formatCents } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
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

function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="pointer-events-none absolute left-full ml-3 z-50 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap"
          style={{
            backgroundColor: "var(--color-brand-surface-strong)",
            color: "var(--color-text-main)",
            border: "1px solid var(--color-border-soft)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {label}
          {/* Arrow */}
          <span
            className="absolute right-full top-1/2 -translate-y-1/2"
            style={{
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderRight: "5px solid var(--color-border-soft)",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const { data: session } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Persist + sync collapsed state with CSS and localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setCollapsed(true);
      document.documentElement.setAttribute("data-sidebar", "collapsed");
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    document.documentElement.setAttribute("data-sidebar", next ? "collapsed" : "expanded");
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/markets");
    router.refresh();
  }

  const w = collapsed ? "w-[60px]" : "w-[220px]";

  return (
    <aside
      className={`hidden md:flex fixed left-0 top-0 h-screen ${w} flex-col z-40 border-r transition-[width] duration-200`}
      style={{
        backgroundColor: "var(--color-brand-nav)",
        borderColor: "var(--color-border-soft)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Logo row */}
      <div
        className="flex items-center h-14 border-b shrink-0 overflow-hidden"
        style={{ borderColor: "var(--color-border-soft)", padding: collapsed ? "0 14px" : "0 20px" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
          style={{ background: "linear-gradient(180deg, rgba(148,228,132,0.95) 0%, rgba(110,200,95,0.95) 100%)" }}
        >
          <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span className="ml-2.5 text-sm font-semibold tracking-tight whitespace-nowrap" style={{ color: "var(--color-text-main)" }}>
            Ratio Markets
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav aria-label="Main navigation" className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname, section);
          const link = (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-3 rounded-lg text-sm font-medium transition-all w-full"
              style={{
                padding: collapsed ? "10px 11px" : "10px 12px",
                ...(active
                  ? { backgroundColor: "rgba(148,228,132,0.12)", color: "var(--color-yes)" }
                  : { color: "var(--color-text-muted)" }),
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          return collapsed ? (
            <Tooltip key={item.href} label={item.label}>
              {link}
            </Tooltip>
          ) : (
            <div key={item.href}>{link}</div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t space-y-2 shrink-0 overflow-hidden" style={{ borderColor: "var(--color-border-soft)" }}>
        {/* Balance */}
        {session && !collapsed && (
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ backgroundColor: "rgba(148,228,132,0.08)", border: "1px solid rgba(148,228,132,0.18)" }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--color-text-soft)" }}>Balance</p>
            <p className="text-sm font-semibold tabular" style={{ color: "var(--color-yes)" }}>
              {formatCents(session.user?.cashBalanceCents ?? 0)}
            </p>
          </div>
        )}
        {session && collapsed && (
          <Tooltip label={formatCents(session.user?.cashBalanceCents ?? 0)}>
            <div
              className="flex items-center justify-center w-full rounded-lg py-2"
              style={{ backgroundColor: "rgba(148,228,132,0.08)", border: "1px solid rgba(148,228,132,0.18)" }}
            >
              <Wallet className="h-4 w-4" style={{ color: "var(--color-yes)" }} />
            </div>
          </Tooltip>
        )}

        {/* Theme toggle + sign out + collapse */}
        <div className={`flex items-center ${collapsed ? "flex-col gap-1.5" : "justify-between"} px-1`}>
          {!collapsed && <ThemeToggle />}
          {session && (
            collapsed ? (
              <Tooltip label="Sign out">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--color-text-soft)" }}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: "var(--color-text-soft)" }}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )
          )}
          <Tooltip label={collapsed ? "Expand sidebar" : ""}>
            <button
              type="button"
              onClick={toggle}
              className="flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--color-text-soft)" }}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </Tooltip>
          {collapsed && <ThemeToggle />}
        </div>
      </div>
    </aside>
  );
}
